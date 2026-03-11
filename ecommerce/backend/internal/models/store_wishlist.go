package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StoreWishlist struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	CustomerID uuid.UUID      `json:"customer_id" gorm:"type:uuid;not null;uniqueIndex:idx_wishlist_product"`
	ProductID  uuid.UUID      `json:"product_id" gorm:"type:uuid;not null;uniqueIndex:idx_wishlist_product"`
}

func (StoreWishlist) TableName() string {
	return "store_wishlists"
}

func (b *StoreWishlist) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
