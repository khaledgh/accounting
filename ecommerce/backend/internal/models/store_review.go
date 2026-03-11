package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StoreReview struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	CustomerID uuid.UUID      `json:"customer_id" gorm:"type:uuid;not null;index"`
	ProductID  uuid.UUID      `json:"product_id" gorm:"type:uuid;not null;index"`
	Rating     int            `json:"rating" gorm:"not null;default:5"`
	Title      string         `json:"title" gorm:"size:200"`
	Comment    string         `json:"comment"`
	IsApproved bool           `json:"is_approved" gorm:"default:false"`
}

func (StoreReview) TableName() string {
	return "store_reviews"
}

func (b *StoreReview) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
