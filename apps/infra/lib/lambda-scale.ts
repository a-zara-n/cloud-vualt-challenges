export type LambdaScaleStage = 'prod' | 'dev' | 'local'

export type LambdaScaleTarget =
  | 'apiHandler'
  | 'portalFrontend'
  | 'frontend'
  | 'portalAuth'
  | 'portalFetch'
  | 'portalChat'
  | 'portalAdmin'
  | 'dataProcessor'

export type LambdaScaleSettings = {
  memorySize: number
  reservedConcurrentExecutions?: number
  provisionedConcurrentExecutions: number
}

const SCALE_SETTINGS: Record<
  LambdaScaleStage,
  Record<LambdaScaleTarget, LambdaScaleSettings>
> = {
  prod: {
    apiHandler: {
      memorySize: 1024,
      reservedConcurrentExecutions: 150,
      provisionedConcurrentExecutions: 20,
    },
    frontend: {
      memorySize: 1024,
      reservedConcurrentExecutions: 150,
      provisionedConcurrentExecutions: 20,
    },
    portalFrontend: {
      memorySize: 1024,
      reservedConcurrentExecutions: 150,
      provisionedConcurrentExecutions: 20,
    },
    portalAuth: {
      memorySize: 512,
      reservedConcurrentExecutions: 80,
      provisionedConcurrentExecutions: 5,
    },
    portalFetch: {
      memorySize: 512,
      reservedConcurrentExecutions: 50,
      provisionedConcurrentExecutions: 3,
    },
    portalChat: {
      memorySize: 1024,
      reservedConcurrentExecutions: 80,
      provisionedConcurrentExecutions: 5,
    },
    portalAdmin: {
      memorySize: 512,
      reservedConcurrentExecutions: 40,
      provisionedConcurrentExecutions: 3,
    },
    dataProcessor: {
      memorySize: 1024,
      reservedConcurrentExecutions: 30,
      provisionedConcurrentExecutions: 2,
    },
  },
  dev: {
    apiHandler: {
      memorySize: 512,
      provisionedConcurrentExecutions: 0,
    },
    frontend: {
      memorySize: 1024,
      provisionedConcurrentExecutions: 0,
    },
    portalFrontend: {
      memorySize: 1024,
      provisionedConcurrentExecutions: 0,
    },
    portalAuth: {
      memorySize: 256,
      provisionedConcurrentExecutions: 0,
    },
    portalFetch: {
      memorySize: 256,
      provisionedConcurrentExecutions: 0,
    },
    portalChat: {
      memorySize: 512,
      provisionedConcurrentExecutions: 0,
    },
    portalAdmin: {
      memorySize: 256,
      provisionedConcurrentExecutions: 0,
    },
    dataProcessor: {
      memorySize: 512,
      provisionedConcurrentExecutions: 0,
    },
  },
  local: {
    apiHandler: {
      memorySize: 256,
      provisionedConcurrentExecutions: 0,
    },
    frontend: {
      memorySize: 512,
      provisionedConcurrentExecutions: 0,
    },
    portalFrontend: {
      memorySize: 512,
      provisionedConcurrentExecutions: 0,
    },
    portalAuth: {
      memorySize: 256,
      provisionedConcurrentExecutions: 0,
    },
    portalFetch: {
      memorySize: 256,
      provisionedConcurrentExecutions: 0,
    },
    portalChat: {
      memorySize: 512,
      provisionedConcurrentExecutions: 0,
    },
    portalAdmin: {
      memorySize: 256,
      provisionedConcurrentExecutions: 0,
    },
    dataProcessor: {
      memorySize: 512,
      provisionedConcurrentExecutions: 0,
    },
  },
}

function normalizeLambdaScaleStage(stage: string): LambdaScaleStage {
  if (stage === 'prod' || stage === 'production') return 'prod'
  if (stage === 'local') return 'local'
  return 'dev'
}

export function getLambdaScaleSettings(
  stage: string,
  target: LambdaScaleTarget
): LambdaScaleSettings {
  return SCALE_SETTINGS[normalizeLambdaScaleStage(stage)][target]
}
