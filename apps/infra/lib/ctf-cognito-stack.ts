import * as cdk from 'aws-cdk-lib'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as path from 'path'
import type { Construct } from 'constructs'

interface CtfCognitoStackProps extends cdk.StackProps {
  stage: string
}

export class CtfCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient

  constructor(scope: Construct, id: string, props: CtfCognitoStackProps) {
    super(scope, id, props)

    // User Pool: self-signup 有効、MFA オプション
    this.userPool = new cognito.UserPool(this, 'TechVaultEmployeePool', {
      userPoolName: `TechVaultEmployeePool-${props.stage}`,
      selfSignUpEnabled: true, // 意図的な脆弱性: 任意のユーザーがサインアップ可能
      signInAliases: {
        email: true,
      },
      autoVerify: {
        email: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: false,
        otp: true,
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: false,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: cdk.Duration.days(7),
      },
      customAttributes: {
        // custom:role - ミュータブル: true（脆弱性）
        role: new cognito.StringAttribute({
          mutable: true, // 意図的な脆弱性: ユーザーが自分で role を設定可能
          maxLen: 10,
        }),
        // custom:department
        department: new cognito.StringAttribute({
          mutable: true,
          maxLen: 50,
        }),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // App Client: USER_PASSWORD_AUTH フロー、client secret なし
    this.userPoolClient = this.userPool.addClient('TechVaultPortalClient', {
      userPoolClientName: `techvault-portal-client-${props.stage}`,
      generateSecret: false, // SPA のため client secret なし
      authFlows: {
        userPassword: true, // USER_PASSWORD_AUTH 有効
        userSrp: false,
      },
      oAuth: {
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
          cognito.OAuthScope.COGNITO_ADMIN, // aws.cognito.signin.user.admin スコープ
        ],
      },
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('role', 'department'),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({ email: true })
        .withCustomAttributes('role', 'department'), // 意図的: ユーザーが role を書き込み可能
    })

    const preSignUp = new lambda.Function(this, 'CognitoPreSignUp', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/cognito-pre-signup')),
      timeout: cdk.Duration.seconds(5),
      description: 'Auto-confirm TechVault CTF self signups to avoid Cognito default email quota.',
    })

    this.userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, preSignUp)

    const employeeEmail = process.env.PORTAL_EMPLOYEE_EMAIL ?? 'employee@techvault.example'
    const employeePassword = process.env.PORTAL_EMPLOYEE_PASSWORD ?? 'EmployeePass2026!'
    const employeeUserPolicy = cr.AwsCustomResourcePolicy.fromSdkCalls({
      resources: [this.userPool.userPoolArn],
    })

    const createEmployeeUser = new cr.AwsCustomResource(this, 'CreateEmployeeCognitoUser', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminCreateUser',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          Username: employeeEmail,
          MessageAction: 'SUPPRESS',
          UserAttributes: [
            { Name: 'email', Value: employeeEmail },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:role', Value: 'employee' },
            { Name: 'custom:department', Value: 'engineering' },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.of(`techvault-employee-user-${props.stage}`),
      },
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminUpdateUserAttributes',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          Username: employeeEmail,
          UserAttributes: [
            { Name: 'email', Value: employeeEmail },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'custom:role', Value: 'employee' },
            { Name: 'custom:department', Value: 'engineering' },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.of(`techvault-employee-user-${props.stage}`),
      },
      onDelete: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminDeleteUser',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          Username: employeeEmail,
        },
        ignoreErrorCodesMatching: 'UserNotFoundException|ResourceNotFoundException',
      },
      policy: employeeUserPolicy,
      installLatestAwsSdk: true,
    })

    const setEmployeePassword = new cr.AwsCustomResource(this, 'SetEmployeeCognitoPassword', {
      onCreate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          Username: employeeEmail,
          Password: employeePassword,
          Permanent: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`techvault-employee-password-${props.stage}`),
      },
      onUpdate: {
        service: 'CognitoIdentityServiceProvider',
        action: 'adminSetUserPassword',
        parameters: {
          UserPoolId: this.userPool.userPoolId,
          Username: employeeEmail,
          Password: employeePassword,
          Permanent: true,
        },
        physicalResourceId: cr.PhysicalResourceId.of(`techvault-employee-password-${props.stage}`),
      },
      policy: employeeUserPolicy,
      installLatestAwsSdk: true,
    })
    setEmployeePassword.node.addDependency(createEmployeeUser)

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    })
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    })
  }
}
