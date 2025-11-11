import { TokenClaims } from './token-validator.js';

export class AuthorizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class AuthorizationEnforcer {
  constructor(private realm: string) {}

  canAccess(
    claims: TokenClaims,
    method: string,
    resource: string
  ): boolean {
    // Validate that the resource is within the realm
    if (!this.isWithinRealm(resource)) {
      throw new AuthorizationError(
        `Resource ${resource} is not within realm ${this.realm}`,
        'INVALID_RESOURCE',
        400
      );
    }

    // Validate that the audience claim allows access to this resource
    if (!this.audienceAllowsResource(claims.aud, resource)) {
      throw new AuthorizationError(
        'Token audience does not permit access to this resource',
        'AUDIENCE_MISMATCH',
        403
      );
    }

    // Map HTTP method to required action
    const requiredAction = this.mapMethodToAction(method);

    // In the basic implementation, if the token is valid and the audience matches,
    // all CRUD operations are allowed. In a production system, you would check
    // authorization_details or implement a policy engine here.
    
    return true;
  }

  private isWithinRealm(resource: string): boolean {
    try {
      const realmUrl = new URL(this.realm);
      const resourceUrl = new URL(resource);

      const realmPath = realmUrl.pathname.replace(/\/$/, '');
      const resourcePath = resourceUrl.pathname.replace(/\/$/, '');

      return (
        realmUrl.origin === resourceUrl.origin &&
        (resourcePath === realmPath || resourcePath.startsWith(realmPath + '/'))
      );
    } catch (error) {
      return false;
    }
  }

  private audienceAllowsResource(aud: string, resource: string): boolean {
    try {
      const audUrl = new URL(aud);
      const resourceUrl = new URL(resource);

      const audPath = audUrl.pathname.replace(/\/$/, '');
      const resourcePath = resourceUrl.pathname.replace(/\/$/, '');

      return (
        audUrl.origin === resourceUrl.origin &&
        (resourcePath === audPath || resourcePath.startsWith(audPath + '/'))
      );
    } catch (error) {
      return false;
    }
  }

  private mapMethodToAction(method: string): string {
    const methodUpper = method.toUpperCase();
    
    switch (methodUpper) {
      case 'GET':
      case 'HEAD':
      case 'OPTIONS':
        return 'Read';
      case 'PUT':
        return 'Update'; // Or Create if resource doesn't exist
      case 'POST':
        return 'Create';
      case 'PATCH':
        return 'Append'; // Or Update
      case 'DELETE':
        return 'Delete';
      default:
        throw new AuthorizationError(
          `Unsupported HTTP method: ${method}`,
          'UNSUPPORTED_METHOD',
          405
        );
    }
  }

  getRealmChallenge(): string {
    return this.realm;
  }
}
