package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type StoreCart struct {
	ID         uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	CustomerID uuid.UUID      `json:"customer_id" gorm:"type:uuid;not null;uniqueIndex"`
	Items      []StoreCartItem `json:"items,omitempty" gorm:"foreignKey:CartID"`
}

func (StoreCart) TableName() string {
	return "store_carts"
}

func (b *StoreCart) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}

type StoreCartItem struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
	CartID    uuid.UUID      `json:"cart_id" gorm:"type:uuid;not null;index"`
	ProductID uuid.UUID      `json:"product_id" gorm:"type:uuid;not null"`
	VariantID *uuid.UUID     `json:"variant_id" gorm:"type:uuid"`
	Quantity  int            `json:"quantity" gorm:"not null;default:1"`
}

func (StoreCartItem) TableName() string {
	return "store_cart_items"
}

func (b *StoreCartItem) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
