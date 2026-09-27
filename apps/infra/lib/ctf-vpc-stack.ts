import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import type { Construct } from 'constructs'

interface CtfVpcStackProps extends cdk.StackProps {
  stage: string
}

export class CtfVpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc
  public readonly publicSubnet: ec2.ISubnet
  public readonly privateSubnetA: ec2.ISubnet
  public readonly privateSubnetC: ec2.ISubnet
  public readonly sgEc2: ec2.SecurityGroup
  public readonly sgLambdaVpc: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: CtfVpcStackProps) {
    super(scope, id, props)

    this.vpc = new ec2.Vpc(this, 'TechVaultVpc', {
      vpcName: `techvault-vpc-${props.stage}`,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'subnet-public',
          subnetType: ec2.SubnetType.PUBLIC,
          mapPublicIpOnLaunch: true,
        },
        {
          cidrMask: 24,
          name: 'subnet-private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    })

    this.publicSubnet = this.vpc.publicSubnets[0]
    this.privateSubnetA = this.vpc.privateSubnets[0]
    this.privateSubnetC = this.vpc.privateSubnets.length > 1
      ? this.vpc.privateSubnets[1]
      : this.vpc.privateSubnets[0]

    // Keep the historical cross-stack export while Lambda/Portal stacks move to subnet A.
    // CloudFormation blocks export deletion until every importing stack has been updated.
    const legacyPrivateSubnet2Export = new cdk.CfnOutput(
      this,
      'LegacyPrivateSubnet2SubnetExport',
      {
        value: this.privateSubnetC.subnetId,
        exportName: `${cdk.Stack.of(this).stackName}:ExportsOutputRefTechVaultVpcsubnetprivateSubnet2SubnetA3ED9170EA60F0DA`,
      },
    )
    legacyPrivateSubnet2Export.overrideLogicalId(
      'ExportsOutputRefTechVaultVpcsubnetprivateSubnet2SubnetA3ED9170EA60F0DA',
    )

    // SG: EC2 (意図的に緩いルール)
    this.sgEc2 = new ec2.SecurityGroup(this, 'SgEc2', {
      vpc: this.vpc,
      securityGroupName: `techvault-ec2-sg-${props.stage}`,
      description: 'EC2 instance SG - intentionally loose for CTF',
      allowAllOutbound: true,
    })
    this.sgEc2.addIngressRule(
      ec2.Peer.ipv4('10.0.0.0/16'),
      ec2.Port.tcp(22),
      'SSH from VPC (intentionally broad)',
    )
    this.sgEc2.addIngressRule(
      ec2.Peer.ipv4('10.0.0.0/16'),
      ec2.Port.tcp(80),
      'HTTP from VPC for internal fetch API',
    )

    // SG: Lambda VPC
    this.sgLambdaVpc = new ec2.SecurityGroup(this, 'SgLambdaVpc', {
      vpc: this.vpc,
      securityGroupName: `techvault-lambda-vpc-sg-${props.stage}`,
      description: 'Lambda VPC SG',
      allowAllOutbound: true,
    })
  }
}
