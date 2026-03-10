package models

import "github.com/google/uuid"

type User struct {
	BaseModel
	CompanyID  uuid.UUID  `json:"company_id" gorm:"type:uuid;not null;index"`
	Company    *Company   `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	BranchID   *uuid.UUID `json:"branch_id" gorm:"type:uuid;index"`
	Branch     *Branch    `json:"branch,omitempty" gorm:"foreignKey:BranchID"`
	Email      string     `json:"email" gorm:"uniqueIndex;not null;size:255"`
	Password   string     `json:"-" gorm:"not null"`
	FirstName  string     `json:"first_name" gorm:"not null;size:100"`
	LastName   string     `json:"last_name" gorm:"not null;size:100"`
	Phone      string     `json:"phone" gorm:"size:50"`
	Avatar     string     `json:"avatar" gorm:"size:500"`
	IsActive   bool       `json:"is_active" gorm:"default:true"`
	IsSuperAdmin bool     `json:"is_super_admin" gorm:"default:false"`
	LastLoginAt *string   `json:"last_login_at"`
	UserRoles  []UserRole `json:"user_roles,omitempty" gorm:"foreignKey:UserID"`
}

func (User) TableName() string {
	return "users"
}

type Role struct {
	BaseModel
	CompanyID   uuid.UUID        `json:"company_id" gorm:"type:uuid;not null;index"`
	Company     *Company         `json:"company,omitempty" gorm:"foreignKey:CompanyID"`
	Name        string           `json:"name" gorm:"not null;size:100"`
	Code        string           `json:"code" gorm:"not null;size:50"`
	Description string           `json:"description"`
	IsSystem    bool             `json:"is_system" gorm:"default:false"`
	IsActive    bool             `json:"is_active" gorm:"default:true"`
	Permissions []RolePermission `json:"permissions,omitempty" gorm:"foreignKey:RoleID"`
}

func (Role) TableName() string {
	return "roles"
}

type Permission struct {
	BaseModel
	Module      string `json:"module" gorm:"not null;size:100;index"`
	Action      string `json:"action" gorm:"not null;size:50"`
	Resource    string `json:"resource" gorm:"not null;size:100"`
	Description string `json:"description"`
}

func (Permission) TableName() string {
	return "permissions"
}

type RolePermission struct {
	BaseModel
	RoleID       uuid.UUID   `json:"role_id" gorm:"type:uuid;not null;uniqueIndex:idx_role_perm"`
	Role         *Role       `json:"role,omitempty" gorm:"foreignKey:RoleID"`
	PermissionID uuid.UUID   `json:"permission_id" gorm:"type:uuid;not null;uniqueIndex:idx_role_perm"`
	Permission   *Permission `json:"permission,omitempty" gorm:"foreignKey:PermissionID"`
}

func (RolePermission) TableName() string {
	return "role_permissions"
}

type UserRole struct {
	BaseModel
	UserID   uuid.UUID `json:"user_id" gorm:"type:uuid;not null;uniqueIndex:idx_user_role"`
	User     *User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
	RoleID   uuid.UUID `json:"role_id" gorm:"type:uuid;not null;uniqueIndex:idx_user_role"`
	Role     *Role     `json:"role,omitempty" gorm:"foreignKey:RoleID"`
	BranchID *uuid.UUID `json:"branch_id" gorm:"type:uuid"`
	Branch   *Branch   `json:"branch,omitempty" gorm:"foreignKey:BranchID"`
}

func (UserRole) TableName() string {
	return "user_roles"
}

type AuditLog struct {
	BaseModel
	UserID     *uuid.UUID `json:"user_id" gorm:"type:uuid;index"`
	User       *User      `json:"user,omitempty" gorm:"foreignKey:UserID"`
	CompanyID  uuid.UUID  `json:"company_id" gorm:"type:uuid;index"`
	Module     string     `json:"module" gorm:"not null;size:100;index"`
	Action     string     `json:"action" gorm:"not null;size:50"`
	Resource   string     `json:"resource" gorm:"not null;size:100"`
	ResourceID string     `json:"resource_id" gorm:"size:100"`
	OldValues  string     `json:"old_values" gorm:"type:jsonb"`
	NewValues  string     `json:"new_values" gorm:"type:jsonb"`
	IPAddress  string     `json:"ip_address" gorm:"size:50"`
	UserAgent  string     `json:"user_agent" gorm:"size:500"`
}

func (AuditLog) TableName() string {
	return "audit_logs"
}
