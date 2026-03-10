export interface User {
  id: string
  company_id: string
  branch_id?: string
  email: string
  first_name: string
  last_name: string
  phone?: string
  avatar?: string
  is_active: boolean
  is_super_admin: boolean
  last_login_at?: string
  company?: Company
  branch?: Branch
  user_roles?: UserRole[]
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  code: string
  tax_id?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  postal_code?: string
  website?: string
  logo?: string
  currency_id?: string
  is_active: boolean
  branches?: Branch[]
  created_at: string
  updated_at: string
}

export interface Branch {
  id: string
  company_id: string
  name: string
  code: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  is_active: boolean
  is_main: boolean
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  company_id: string
  name: string
  code: string
  description?: string
  is_system: boolean
  is_active: boolean
  permissions?: RolePermission[]
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  module: string
  action: string
  resource: string
  description?: string
}

export interface RolePermission {
  id: string
  role_id: string
  permission_id: string
  permission?: Permission
}

export interface UserRole {
  id: string
  user_id: string
  role_id: string
  branch_id?: string
  role?: Role
  branch?: Branch
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface APIResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface PaginationParams {
  page: number
  page_size: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
  search?: string
  [key: string]: string | number | undefined
}
