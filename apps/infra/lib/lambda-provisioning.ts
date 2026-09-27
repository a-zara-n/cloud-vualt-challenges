import * as lambda from 'aws-cdk-lib/aws-lambda'
import type { Construct } from 'constructs'
import type { LambdaScaleSettings } from './lambda-scale'

export function getLambdaInvokeTarget(
  scope: Construct,
  id: string,
  fn: lambda.Function,
  scale: LambdaScaleSettings
): lambda.IFunction {
  if (scale.provisionedConcurrentExecutions <= 0) {
    return fn
  }

  return new lambda.Alias(scope, `${id}LiveAlias`, {
    aliasName: 'live',
    version: fn.currentVersion,
    provisionedConcurrentExecutions: scale.provisionedConcurrentExecutions,
  })
}
