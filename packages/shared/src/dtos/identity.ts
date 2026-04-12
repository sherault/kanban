export interface UserDto {
  id: string
  email: string
  displayName: string
  emailVerified: boolean
  totpEnabled: boolean
  createdAt: string
}

export interface ApiKeyDto {
  id: string
  label: string
  lastUsedAt: string | null
  createdAt: string
}

// Returned only at creation — raw key never stored
export interface ApiKeyCreatedDto extends ApiKeyDto {
  rawKey: string
}
