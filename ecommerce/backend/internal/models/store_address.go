package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StoreAddress struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	CustomerID uuid.UUID      `json:"customer_id" gorm:"type:uuid;not null;index"`
	Label      string         `json:"label" gorm:"size:50;default:'home'"`
	FirstName  string         `json:"first_name" gorm:"not null;size:100"`
	LastName   string         `json:"last_name" gorm:"not null;size:100"`
	Phone      string         `json:"phone" gorm:"size:50"`
	Address1   string         `json:"address1" gorm:"not null"`
	Address2   string         `json:"address2"`
	City       string         `json:"city" gorm:"not null;size:100"`
	State      string         `json:"state" gorm:"size:100"`
	PostalCode string         `json:"postal_code" gorm:"not null;size:20"`
	Country    string         `json:"country" gorm:"not null;size:100;default:'US'"`
	IsDefault  bool           `json:"is_default" gorm:"default:false"`
}

func (StoreAddress) TableName() string {
	return "store_addresses"
}

func (b *StoreAddress) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
