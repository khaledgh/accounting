package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StoreFavorite struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt  time.Time      `json:"created_at"`
	DeletedAt  gorm.DeletedAt `json:"-" gorm:"index"`
	CustomerID uuid.UUID      `json:"customer_id" gorm:"type:uuid;not null;uniqueIndex:idx_fav_customer_product"`
	ProductID  uuid.UUID      `json:"product_id" gorm:"type:uuid;not null;uniqueIndex:idx_fav_customer_product;index:idx_fav_product"`
}

func (StoreFavorite) TableName() string {
	return "store_favorites"
}

func (b *StoreFavorite) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
