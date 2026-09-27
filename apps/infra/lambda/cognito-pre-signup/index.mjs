export async function handler(event) {
  event.response.autoConfirmUser = true;

  if (event.request?.userAttributes?.email) {
    event.response.autoVerifyEmail = true;
  }

  return event;
}
