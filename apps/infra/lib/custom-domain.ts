import * as cdk from 'aws-cdk-lib'
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2'
import * as acm from 'aws-cdk-lib/aws-certificatemanager'
import * as route53 from 'aws-cdk-lib/aws-route53'
import * as targets from 'aws-cdk-lib/aws-route53-targets'
import type { Construct } from 'constructs'

type CloudFortressService = 'api' | 'dashboard' | 'techvault'

interface HttpApiCustomDomainProps {
  api: apigwv2.CfnApi
  outputDescription: string
  outputId: string
  service: CloudFortressService
  stage: apigwv2.CfnStage
  stageName: string
}

function hostedZoneName(scope: Construct): string {
  return (
    scope.node.tryGetContext('cloudFortressHostedZoneName') ??
    process.env.CLOUDFORTRESS_HOSTED_ZONE_NAME ??
    'cloudfortress.security.jaws-ug.jp'
  )
}

function hostedZoneId(scope: Construct): string | undefined {
  return scope.node.tryGetContext('cloudFortressHostedZoneId') ?? process.env.CLOUDFORTRESS_HOSTED_ZONE_ID
}

export function cloudFortressDomainName(
  scope: Construct,
  stageName: string,
  service: CloudFortressService,
): string | undefined {
  if (stageName !== 'dev' && stageName !== 'prod') {
    return undefined
  }

  const zoneName = hostedZoneName(scope)
  return stageName === 'prod'
    ? `${service}.${zoneName}`
    : `${service}.${stageName}.${zoneName}`
}

export function configureHttpApiCustomDomain(
  scope: Construct,
  props: HttpApiCustomDomainProps,
): string | undefined {
  const domainName = cloudFortressDomainName(scope, props.stageName, props.service)
  if (!domainName) {
    return undefined
  }

  const zoneName = hostedZoneName(scope)
  const zoneId = hostedZoneId(scope)
  const recordName =
    props.stageName === 'prod' ? props.service : `${props.service}.${props.stageName}`

  const hostedZone = zoneId
    ? route53.HostedZone.fromHostedZoneAttributes(scope, 'CloudFortressHostedZone', {
        hostedZoneId: zoneId,
        zoneName,
      })
    : route53.HostedZone.fromLookup(scope, 'CloudFortressHostedZone', {
        domainName: zoneName,
      })

  const certificate = new acm.Certificate(scope, 'Certificate', {
    domainName,
    validation: acm.CertificateValidation.fromDns(hostedZone),
  })

  const apiDomain = new apigwv2.CfnDomainName(scope, 'DomainName', {
    domainName,
    domainNameConfigurations: [
      {
        certificateArn: certificate.certificateArn,
        endpointType: 'REGIONAL',
        securityPolicy: 'TLS_1_2',
      },
    ],
  })

  const apiMapping = new apigwv2.CfnApiMapping(scope, 'ApiMapping', {
    apiId: props.api.ref,
    domainName: apiDomain.ref,
    stage: props.stage.stageName,
  })
  apiMapping.addDependency(props.stage)

  const recordTarget = route53.RecordTarget.fromAlias(
    new targets.ApiGatewayv2DomainProperties(
      apiDomain.attrRegionalDomainName,
      apiDomain.attrRegionalHostedZoneId,
    ),
  )

  new route53.ARecord(scope, 'AliasRecord', {
    zone: hostedZone,
    recordName,
    target: recordTarget,
  })

  new route53.AaaaRecord(scope, 'Ipv6AliasRecord', {
    zone: hostedZone,
    recordName,
    target: recordTarget,
  })

  new cdk.CfnOutput(scope, props.outputId, {
    value: `https://${domainName}`,
    description: props.outputDescription,
  })

  return domainName
}
