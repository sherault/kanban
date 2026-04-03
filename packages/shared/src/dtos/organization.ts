import type { Role } from '../enums/roles.js'

export interface OrganizationDto {
  id: string
  name: string
  website: string | null
  createdAt: string
}

export interface MembershipDto {
  userId: string
  organizationId: string
  role: Role
  user: Pick<import('./identity.js').UserDto, 'id' | 'displayName' | 'email'>
}

export interface InvitationTokenDto {
  id: string
  organizationId: string
  expiresAt: string
  createdAt: string
}
