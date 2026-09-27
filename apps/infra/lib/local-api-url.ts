// Floci's REST API execute plane uses the /restapis/.../_user_request_/ path.
export function localRestApiUrl(apiId: string, stage: string): string {
  return `http://${apiId}.execute-api.localhost.floci.io:4566/restapis/${apiId}/${stage}/_user_request_/`;
}
