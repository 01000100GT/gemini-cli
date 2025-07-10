/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { MCPOAuthConfig } from './oauth-provider.js';
import { getErrorMessage } from '../utils/errors.js';

/**
 * OAuth authorization server metadata as per RFC 8414.
 */
export interface OAuthAuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  token_endpoint_auth_methods_supported?: string[];
  revocation_endpoint?: string;
  revocation_endpoint_auth_methods_supported?: string[];
  registration_endpoint?: string;
  response_types_supported?: string[];
  grant_types_supported?: string[];
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
}

/**
 * OAuth protected resource metadata as per RFC 9728.
 */
export interface OAuthProtectedResourceMetadata {
  resource: string;
  authorization_servers?: string[];
  bearer_methods_supported?: string[];
  resource_documentation?: string;
  resource_signing_alg_values_supported?: string[];
  resource_encryption_alg_values_supported?: string[];
  resource_encryption_enc_values_supported?: string[];
}

/**
 * Discover OAuth configuration from an MCP server.
 * 
 * @param serverUrl The base URL of the MCP server
 * @returns The discovered OAuth configuration or null if not available
 */
export async function discoverOAuthConfig(
  serverUrl: string
): Promise<MCPOAuthConfig | null> {
  try {
    // First, try to get the protected resource metadata
    const resourceMetadataUrl = new URL('/.well-known/oauth-protected-resource', serverUrl).toString();
    
    const resourceResponse = await fetch(resourceMetadataUrl);
    if (!resourceResponse.ok) {
      console.debug(`No OAuth protected resource metadata found at ${resourceMetadataUrl}`);
      return null;
    }
    
    const resourceMetadata = await resourceResponse.json() as OAuthProtectedResourceMetadata;
    
    if (!resourceMetadata.authorization_servers || resourceMetadata.authorization_servers.length === 0) {
      console.debug('No authorization servers specified in protected resource metadata');
      return null;
    }
    
    // Use the first authorization server
    const authServerUrl = resourceMetadata.authorization_servers[0];
    
    // Get the authorization server metadata
    const authServerMetadataUrl = new URL('/.well-known/oauth-authorization-server', authServerUrl).toString();
    
    const authServerResponse = await fetch(authServerMetadataUrl);
    if (!authServerResponse.ok) {
      console.error(`Failed to fetch authorization server metadata from ${authServerMetadataUrl}`);
      return null;
    }
    
    const authServerMetadata = await authServerResponse.json() as OAuthAuthorizationServerMetadata;
    
    // Build OAuth configuration from discovered metadata
    const oauthConfig: MCPOAuthConfig = {
      authorizationUrl: authServerMetadata.authorization_endpoint,
      tokenUrl: authServerMetadata.token_endpoint,
      scopes: authServerMetadata.scopes_supported || [],
    };
    
    // Check if dynamic client registration is supported
    if (authServerMetadata.registration_endpoint) {
      console.log('Dynamic client registration is supported at:', authServerMetadata.registration_endpoint);
      // TODO: Implement dynamic client registration
    }
    
    return oauthConfig;
    
  } catch (error) {
    console.debug(`Failed to discover OAuth configuration: ${getErrorMessage(error)}`);
    return null;
  }
}

/**
 * Parse WWW-Authenticate header to extract OAuth information.
 * 
 * @param header The WWW-Authenticate header value
 * @returns The resource metadata URI if found
 */
export function parseWWWAuthenticateHeader(header: string): string | null {
  // Parse Bearer realm and resource_metadata_uri
  const match = header.match(/resource_metadata_uri="([^"]+)"/);
  if (match) {
    return match[1];
  }
  
  return null;
} 