package models

import (
	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type Product struct {
	models.BaseModel
	CompanyID       uuid.UUID        `json:"company_id" gorm:"type:uuid;not null;index"`
	CategoryID      *uuid.UUID       `json:"category_id" gorm:"type:uuid;index"`
	Category        *Category        `json:"category,omitempty" gorm:"foreignKey:CategoryID"`
	SKU             string           `json:"sku" gorm:"not null;size:50;uniqueIndex:idx_product_sku"`
	Name            string           `json:"name" gorm:"not null;size:300"`
	Description     string           `json:"description"`
	ShortDesc       string           `json:"short_desc" gorm:"size:500"`
	Price           float64          `json:"price" gorm:"type:decimal(18,4);not null;default:0"`
	CostPrice       float64          `json:"cost_price" gorm:"type:decimal(18,4);default:0"`
	ComparePrice    float64          `json:"compare_price" gorm:"type:decimal(18,4);default:0"`
	CurrencyCode    string           `json:"currency_code" gorm:"size:3;default:'USD'"`
	TaxRate         float64          `json:"tax_rate" gorm:"type:decimal(5,2);default:0"`
	Weight          float64          `json:"weight" gorm:"type:decimal(10,2);default:0"`
	Unit            string           `json:"unit" gorm:"size:20;default:'pc'"`
	Barcode         string           `json:"barcode" gorm:"size:50;index"`
	ImageURL        string           `json:"image_url" gorm:"size:500"`
	Slug            string           `json:"slug" gorm:"size:300;index"`
	MetaTitle       string           `json:"meta_title" gorm:"size:200"`
	MetaDescription string           `json:"meta_description" gorm:"column:meta_description;size:500"`
	IsActive        bool             `json:"is_active" gorm:"default:true"`
	IsDigital       bool             `json:"is_digital" gorm:"default:false"`
	TrackStock      bool             `json:"track_stock" gorm:"default:true"`
	StockQuantity   int              `json:"stock_quantity" gorm:"default:0"`
	LowStockAlert   int              `json:"low_stock_alert" gorm:"default:5"`
	Variants        []ProductVariant `json:"variants,omitempty" gorm:"foreignKey:ProductID"`
}

func (Product) TableName() string {
	return "products"
}

type ProductVariant struct {
	models.BaseModel
	ProductID     uuid.UUID `json:"product_id" gorm:"type:uuid;not null;index"`
	SKU           string    `json:"sku" gorm:"not null;size:50"`
	Name          string    `json:"name" gorm:"not null;size:200"`
	Price         float64   `json:"price" gorm:"type:decimal(18,4);not null"`
	CostPrice     float64   `json:"cost_price" gorm:"type:decimal(18,4);default:0"`
	StockQuantity int       `json:"stock_quantity" gorm:"default:0"`
	ImageURL      string    `json:"image_url" gorm:"size:500"`
	IsActive      bool      `json:"is_active" gorm:"default:true"`
}

func (ProductVariant) TableName() string {
	return "product_variants"
}

type Category struct {
	models.BaseModel
	CompanyID   uuid.UUID  `json:"company_id" gorm:"type:uuid;not null;index"`
	ParentID    *uuid.UUID `json:"parent_id" gorm:"type:uuid;index"`
	Parent      *Category  `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children    []Category `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	Name        string     `json:"name" gorm:"not null;size:200"`
	Slug        string     `json:"slug" gorm:"not null;size:200;index"`
	Description string     `json:"description"`
	ImageURL    string     `json:"image_url" gorm:"size:500"`
	SortOrder   int        `json:"sort_order" gorm:"default:0"`
	IsActive    bool       `json:"is_active" gorm:"default:true"`
}

func (Category) TableName() string {
	return "categories"
}
