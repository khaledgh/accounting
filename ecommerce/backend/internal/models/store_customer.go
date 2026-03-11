package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StoreCustomer struct {
	ID              uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	Email           string         `json:"email" gorm:"uniqueIndex;not null;size:255"`
	Password        string         `json:"-" gorm:"not null"`
	FirstName       string         `json:"first_name" gorm:"not null;size:100"`
	LastName        string         `json:"last_name" gorm:"not null;size:100"`
	Phone           string         `json:"phone" gorm:"size:50"`
	Avatar          string         `json:"avatar" gorm:"size:500"`
	IsActive        bool           `json:"is_active" gorm:"default:true"`
	EmailVerified   bool           `json:"email_verified" gorm:"default:false"`
	EmailVerifyToken string        `json:"-" gorm:"size:255"`
	ResetToken      string         `json:"-" gorm:"size:255"`
	ResetTokenExp   *time.Time     `json:"-"`
	LastLoginAt     *time.Time     `json:"last_login_at"`
	Addresses       []StoreAddress `json:"addresses,omitempty" gorm:"foreignKey:CustomerID"`
}

func (StoreCustomer) TableName() string {
	return "store_customers"
}

func (b *StoreCustomer) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
