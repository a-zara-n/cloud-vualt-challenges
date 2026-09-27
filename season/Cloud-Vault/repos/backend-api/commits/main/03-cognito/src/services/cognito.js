const {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminUpdateUserAttributesCommand,
  ListUsersCommand,
} = require('@aws-sdk/client-cognito-identity-provider');

const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'ap-northeast-1',
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID;

/**
 * Cognito authentication service
 * Handles user management operations via AWS Cognito
 */
class CognitoService {
  /**
   * Get user details from Cognito
   * @param {string} username - Cognito username (sub)
   * @returns {Promise<Object>} User details
   */
  async getUser(username) {
    const command = new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
    });

    try {
      const response = await cognitoClient.send(command);
      return this._formatUser(response);
    } catch (error) {
      if (error.name === 'UserNotFoundException') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create a new user in Cognito
   * @param {Object} userData - User data
   * @param {string} userData.email - User email
   * @param {string} userData.name - User display name
   * @param {string} [userData.temporaryPassword] - Temporary password
   * @returns {Promise<Object>} Created user details
   */
  async createUser({ email, name, temporaryPassword }) {
    const command = new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'email_verified', Value: 'true' },
        { Name: 'name', Value: name },
      ],
      TemporaryPassword: temporaryPassword,
      MessageAction: 'SUPPRESS',
    });

    const response = await cognitoClient.send(command);
    return this._formatUser(response.User);
  }

  /**
   * Update user attributes
   * @param {string} username - Cognito username
   * @param {Object} attributes - Attributes to update
   * @returns {Promise<void>}
   */
  async updateUserAttributes(username, attributes) {
    const userAttributes = Object.entries(attributes).map(([key, value]) => ({
      Name: key,
      Value: String(value),
    }));

    const command = new AdminUpdateUserAttributesCommand({
      UserPoolId: USER_POOL_ID,
      Username: username,
      UserAttributes: userAttributes,
    });

    await cognitoClient.send(command);
  }

  /**
   * List users with optional filter
   * @param {Object} options - List options
   * @param {string} [options.filter] - Cognito filter expression
   * @param {number} [options.limit=50] - Max results
   * @returns {Promise<Object[]>} Array of user objects
   */
  async listUsers({ filter, limit = 50 } = {}) {
    const command = new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: limit,
      ...(filter && { Filter: filter }),
    });

    const response = await cognitoClient.send(command);
    return (response.Users || []).map(user => this._formatUser(user));
  }

  /**
   * Format Cognito user response to internal format
   * @private
   */
  _formatUser(cognitoUser) {
    const attributes = {};
    const attrs = cognitoUser.UserAttributes || cognitoUser.Attributes || [];

    for (const attr of attrs) {
      attributes[attr.Name] = attr.Value;
    }

    return {
      username: cognitoUser.Username,
      email: attributes.email,
      name: attributes.name,
      status: cognitoUser.UserStatus,
      enabled: cognitoUser.Enabled,
      createdAt: cognitoUser.UserCreateDate,
      updatedAt: cognitoUser.UserLastModifiedDate,
    };
  }
}

module.exports = new CognitoService();
