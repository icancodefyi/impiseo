export type AuthType = "oauth" | "api_key";

export type ConnectionStatus = "active" | "error";

export type StoredConnection = {
  provider: string;
  status: ConnectionStatus;
  host?: string;
  apiKey?: string;
  projectId?: number;
  projectName?: string;
  accountEmail?: string;
  connectedAt: string;
};

export type PublicConnection = Omit<StoredConnection, "apiKey">;

export type ValidationResult =
  | { ok: true; meta: Partial<StoredConnection> }
  | { ok: false; error: string };

export interface ProviderAdapter {
  id: string;
  label: string;
  description: string;
  authType: AuthType;
  validate(input: { apiKey?: string; host?: string }): Promise<ValidationResult>;
}

export function toPublicConnection(c: StoredConnection): PublicConnection {
  const copy = { ...c };
  delete copy.apiKey;
  return copy;
}
