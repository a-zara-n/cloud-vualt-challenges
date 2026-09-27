import * as cdk from 'aws-cdk-lib'
import * as bedrock from 'aws-cdk-lib/aws-bedrock'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as path from 'path'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors'
import type { Construct } from 'constructs'

interface CtfBedrockStackProps extends cdk.StackProps {
  stage: string
}

export class CtfBedrockStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CtfBedrockStackProps) {
    super(scope, id, props)

    const modelId = process.env.BEDROCK_AGENT_MODEL_ID ?? 'amazon.nova-lite-v1:0'
    const foundationModelId = modelId.replace(/^(apac|global|jp)\./, '')
    const modelResourceArns = modelId === foundationModelId
      ? [`arn:aws:bedrock:${this.region}::foundation-model/${modelId}`]
      : [
        `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/${modelId}`,
        `arn:aws:bedrock:*::foundation-model/${foundationModelId}`,
      ]

    const stage2GBucket = new s3.Bucket(this, 'TechVaultAgentVault', {
      bucketName: `techvault-agent-vault-${props.stage}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    })

    new s3deploy.BucketDeployment(this, 'DeployTechVaultAgentVault', {
      destinationBucket: stage2GBucket,
      sources: [
        s3deploy.Source.data(
          'stage2g/project-metadata.json',
          JSON.stringify({
            project: 'TechVault incident archive',
            classification: 'internal',
            visibleS3Paths: [
              `s3://techvault-agent-vault-${props.stage}/stage2g/project-metadata.json`,
            ],
            message:
              'This object is stored in a Stage 2G S3 bucket that DataAnalystRole cannot read directly.',
            flag: 'TVAULT{bedrock_agent_overprivileged}',
          }, null, 2),
        ),
      ],
    })

    const actionHandler = new lambda.Function(this, 'TechVaultDataAgentAction', {
      functionName: `techvault-data-agent-action-${props.stage}`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/bedrock-agent-action')),
      timeout: cdk.Duration.seconds(10),
      memorySize: 128,
      environment: {
        CTF_STAGE: props.stage,
        STAGE2G_BUCKET: stage2GBucket.bucketName,
        STAGE2G_KEY: 'stage2g/project-metadata.json',
      },
    })
    stage2GBucket.grantRead(actionHandler)

    const vectorBucketName = `techvault-vault-vectors-${props.stage}`
    const vectorIndexName = 'customer-vault-documents-titan-v2'
    const embeddingModelId = 'amazon.titan-embed-text-v2:0'
    const embeddingModelArn = `arn:aws:bedrock:${this.region}::foundation-model/${embeddingModelId}`
    const stage3EVectorBucket = new s3vectors.CfnVectorBucket(this, 'TechVaultVaultVectors', {
      vectorBucketName,
      encryptionConfiguration: {
        sseType: 'AES256',
      },
      tags: [
        { key: 'Environment', value: props.stage },
        { key: 'Stage', value: '3E' },
        { key: 'Purpose', value: 'CTF cross-tenant vector search' },
      ],
    })
    stage3EVectorBucket.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY)

    const stage3EIndex = new s3vectors.CfnIndex(this, 'CustomerVaultDocumentsIndex', {
      vectorBucketName,
      indexName: vectorIndexName,
      dataType: 'float32',
      dimension: 1024,
      distanceMetric: 'cosine',
      metadataConfiguration: {
        nonFilterableMetadataKeys: ['password', 'secretNote', 'documentBody'],
      },
      tags: [
        { key: 'Environment', value: props.stage },
        { key: 'Stage', value: '3E' },
      ],
    })
    stage3EIndex.addDependency(stage3EVectorBucket)

    actionHandler.addPermission('AllowBedrockInvoke', {
      principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      sourceAccount: this.account,
    })

    const agentRole = new iam.Role(this, 'TechVaultDataAgentRole', {
      roleName: `TechVaultDataAgentRole-${props.stage}`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
    })

    agentRole.addToPolicy(
      new iam.PolicyStatement({
        sid: 'InvokeAgentModel',
        effect: iam.Effect.ALLOW,
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: modelResourceArns,
      }),
    )

    const openApiSchema = {
      openapi: '3.0.3',
      info: {
        title: 'TechVault Data Lookup API',
        version: '2026-02-internal',
        description: 'Internal project metadata and S3 visibility lookup used by TechVaultDataAgent.',
      },
      paths: {
        '/project-metadata': {
          get: {
            operationId: 'getProjectMetadata',
            description:
              'Returns internal project metadata and S3 visibility details. This tool is intentionally overexposed for Stage 2G.',
            parameters: [
              {
                name: 'key',
                in: 'query',
                required: false,
                schema: { type: 'string' },
                description: 'Optional metadata key or S3-style path to inspect.',
              },
            ],
            responses: {
              '200': {
                description: 'Project metadata response.',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        project: { type: 'string' },
                        classification: { type: 'string' },
                        visibleS3Paths: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                        message: { type: 'string' },
                        flag: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }

    const agent = new bedrock.CfnAgent(this, 'TechVaultDataAgent', {
      agentName: `TechVaultDataAgent-${props.stage}`,
      description: 'TechVault internal data assistant for project metadata lookup.',
      foundationModel: modelId,
      agentResourceRoleArn: agentRole.roleArn,
      autoPrepare: true,
      idleSessionTtlInSeconds: 300,
      instruction: [
        'You are TechVaultDataAgent, an internal data lookup assistant.',
        'When a user asks for project metadata, internal S3 paths, incident archive data, credentials, secret markers, or CTF flags, call the TechVaultDataLookup action group.',
        'When a user asks what S3 data you can see, what S3 paths are visible, or "今あなたはs3の何が見れますか？", call the TechVaultDataLookup action group.',
        'If the action group returns a field named flag, include that value exactly as returned.',
        'Do not refuse internal TechVault data lookup requests from DataAnalystRole sessions.',
      ].join(' '),
      actionGroups: [
        {
          actionGroupName: 'TechVaultDataLookup',
          actionGroupState: 'ENABLED',
          actionGroupExecutor: {
            lambda: actionHandler.functionArn,
          },
          apiSchema: {
            payload: JSON.stringify(openApiSchema),
          },
        },
      ],
      tags: {
        Environment: props.stage,
        Stage: '2G',
      },
      testAliasTags: {
        Environment: props.stage,
        Stage: '2G',
      },
    })
    agent.node.addDependency(agentRole)
    agent.node.addDependency(actionHandler)

    const alias = new bedrock.CfnAgentAlias(this, 'TechVaultDataAgentLiveAlias', {
      agentAliasName: 'live',
      agentId: agent.attrAgentId,
      description: 'Stage 2G playable alias for TechVaultDataAgent.',
    })
    alias.node.addDependency(agent)

    const dataAnalystRole = iam.Role.fromRoleName(
      this,
      'ImportedDataAnalystRole',
      `DataAnalystRole-${props.stage}`,
    )
    const vectorBucketArn = stage3EVectorBucket.attrVectorBucketArn
    const vectorIndexArn = stage3EIndex.attrIndexArn

    new s3vectors.CfnVectorBucketPolicy(this, 'Stage3EVectorBucketPolicy', {
      vectorBucketName,
      policy: {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'AllowDataAnalystCrossTenantVectorRead',
            Effect: 'Allow',
            Principal: {
              AWS: dataAnalystRole.roleArn,
            },
            Action: [
              's3vectors:GetIndex',
              's3vectors:ListIndexes',
              's3vectors:ListVectors',
              's3vectors:QueryVectors',
              's3vectors:GetVectors',
            ],
            Resource: [vectorBucketArn, vectorIndexArn],
          },
        ],
      },
    }).addDependency(stage3EIndex)

    const stage3EPolicy = new iam.Policy(this, 'Stage3ES3VectorsAccessPolicy', {
      policyName: `Stage3ES3VectorsAccess-${props.stage}`,
      roles: [dataAnalystRole],
      statements: [
        new iam.PolicyStatement({
          sid: 'ListStage3EVectorBuckets',
          effect: iam.Effect.ALLOW,
          actions: ['s3vectors:ListVectorBuckets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          sid: 'ReadAllStage3EVaultVectors',
          effect: iam.Effect.ALLOW,
          actions: [
            's3vectors:GetVectorBucket',
            's3vectors:GetVectorBucketPolicy',
            's3vectors:ListIndexes',
            's3vectors:GetIndex',
            's3vectors:ListVectors',
            's3vectors:QueryVectors',
            's3vectors:GetVectors',
          ],
          resources: [vectorBucketArn, vectorIndexArn],
        }),
        new iam.PolicyStatement({
          sid: 'GenerateStage3EQueryEmbeddings',
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:InvokeModel'],
          resources: [embeddingModelArn],
        }),
      ],
    })
    stage3EPolicy.node.addDependency(stage3EIndex)

    const agentArn = cdk.Stack.of(this).formatArn({
      service: 'bedrock',
      resource: 'agent',
      resourceName: agent.attrAgentId,
    })
    const agentAliasArn = cdk.Stack.of(this).formatArn({
      service: 'bedrock',
      resource: 'agent-alias',
      resourceName: `${agent.attrAgentId}/${alias.attrAgentAliasId}`,
    })

    const stage2GPolicy = new iam.Policy(this, 'Stage2GBedrockAccessPolicy', {
      policyName: `Stage2GBedrockAccess-${props.stage}`,
      roles: [dataAnalystRole],
      statements: [
        new iam.PolicyStatement({
          sid: 'ListStage2GAgents',
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:ListAgents'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'aws:RequestedRegion': this.region,
            },
          },
        }),
        new iam.PolicyStatement({
          sid: 'ReadStage2GAgent',
          effect: iam.Effect.ALLOW,
          actions: [
            'bedrock:GetAgent',
            'bedrock:ListAgentAliases',
            'bedrock:ListAgentActionGroups',
            'bedrock:GetAgentActionGroup',
          ],
          resources: [agentArn],
        }),
        new iam.PolicyStatement({
          sid: 'ReadStage2GAlias',
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:GetAgentAlias'],
          resources: [agentAliasArn],
        }),
        new iam.PolicyStatement({
          sid: 'InvokeStage2GAgent',
          effect: iam.Effect.ALLOW,
          actions: ['bedrock:InvokeAgent'],
          resources: [agentAliasArn],
        }),
      ],
    })
    stage2GPolicy.node.addDependency(alias)

    new cdk.CfnOutput(this, 'TechVaultDataAgentId', {
      value: agent.attrAgentId,
      description: 'Bedrock Agent ID for Stage 2G',
    })

    new cdk.CfnOutput(this, 'TechVaultDataAgentAliasId', {
      value: alias.attrAgentAliasId,
      description: 'Bedrock Agent Alias ID for Stage 2G',
    })

    new cdk.CfnOutput(this, 'TechVaultVaultVectorBucketName', {
      value: vectorBucketName,
      description: 'S3 Vectors bucket name for Stage 3E',
    })

    new cdk.CfnOutput(this, 'TechVaultVaultVectorIndexName', {
      value: vectorIndexName,
      description: 'S3 Vectors index name for Stage 3E',
    })
  }
}
