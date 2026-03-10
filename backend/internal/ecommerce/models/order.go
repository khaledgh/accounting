package models

import (
	"time"

	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "pending"
	OrderStatusConfirmed  OrderStatus = "confirmed"
	OrderStatusProcessing OrderStatus = "processing"
	OrderStatusShipped    OrderStatus = "shipped"
	OrderStatusDelivered  OrderStatus = "delivered"
	OrderStatusCancelled  OrderStatus = "cancelled"
	OrderStatusRefunded   OrderStatus = "refunded"
)

type PaymentStatus string

const (
	PaymentStatusUnpaid   PaymentStatus = "unpaid"
	PaymentStatusPartial  PaymentStatus = "partial"
	PaymentStatusPaid     PaymentStatus = "paid"
	PaymentStatusRefunded PaymentStatus = "refunded"
)

type Order struct {
	models.BaseModel
	CompanyID      uuid.UUID     `json:"company_id" gorm:"type:uuid;not null;index"`
	BranchID       *uuid.UUID    `json:"branch_id" gorm:"type:uuid;index"`
	CustomerID     *uuid.UUID    `json:"customer_id" gorm:"type:uuid;index"`
	Customer       *Customer     `json:"customer,omitempty" gorm:"foreignKey:CustomerID"`
	OrderNumber    string        `json:"order_number" gorm:"not null;size:50;uniqueIndex:idx_order_number"`
	OrderDate      time.Time     `json:"order_date" gorm:"not null"`
	Status         OrderStatus   `json:"status" gorm:"not null;size:20;default:'pending';index"`
	PaymentStatus  PaymentStatus `json:"payment_status" gorm:"not null;size:20;default:'unpaid'"`
	CurrencyCode   string        `json:"currency_code" gorm:"size:3;default:'USD'"`
	Subtotal       float64       `json:"subtotal" gorm:"type:decimal(18,4);default:0"`
	TaxAmount      float64       `json:"tax_amount" gorm:"type:decimal(18,4);default:0"`
	ShippingAmount float64       `json:"shipping_amount" gorm:"type:decimal(18,4);default:0"`
	DiscountAmount float64       `json:"discount_amount" gorm:"type:decimal(18,4);default:0"`
	TotalAmount    float64       `json:"total_amount" gorm:"type:decimal(18,4);default:0"`
	PaidAmount     float64       `json:"paid_amount" gorm:"type:decimal(18,4);default:0"`
	Notes          string        `json:"notes"`
	ShippingName   string        `json:"shipping_name" gorm:"size:200"`
	ShippingAddr   string        `json:"shipping_address"`
	ShippingCity   string        `json:"shipping_city" gorm:"size:100"`
	ShippingState  string        `json:"shipping_state" gorm:"size:100"`
	ShippingZip    string        `json:"shipping_zip" gorm:"size:20"`
	ShippingCountry string       `json:"shipping_country" gorm:"size:100"`
	Items          []OrderItem   `json:"items,omitempty" gorm:"foreignKey:OrderID"`
	Payments       []Payment     `json:"payments,omitempty" gorm:"foreignKey:OrderID"`
}

func (Order) TableName() string {
	return "orders"
}

type OrderItem struct {
	models.BaseModel
	OrderID      uuid.UUID  `json:"order_id" gorm:"type:uuid;not null;index"`
	ProductID    uuid.UUID  `json:"product_id" gorm:"type:uuid;not null;index"`
	Product      *Product   `json:"product,omitempty" gorm:"foreignKey:ProductID"`
	VariantID    *uuid.UUID `json:"variant_id" gorm:"type:uuid"`
	SKU          string     `json:"sku" gorm:"size:50"`
	Name         string     `json:"name" gorm:"not null;size:300"`
	Quantity     int        `json:"quantity" gorm:"not null;default:1"`
	UnitPrice    float64    `json:"unit_price" gorm:"type:decimal(18,4);not null"`
	CostPrice    float64    `json:"cost_price" gorm:"type:decimal(18,4);default:0"`
	TaxRate      float64    `json:"tax_rate" gorm:"type:decimal(5,2);default:0"`
	TaxAmount    float64    `json:"tax_amount" gorm:"type:decimal(18,4);default:0"`
	Discount     float64    `json:"discount" gorm:"type:decimal(18,4);default:0"`
	TotalAmount  float64    `json:"total_amount" gorm:"type:decimal(18,4);not null"`
	LineNumber   int        `json:"line_number" gorm:"not null"`
}

func (OrderItem) TableName() string {
	return "order_items"
}

type Payment struct {
	models.BaseModel
	CompanyID     uuid.UUID  `json:"company_id" gorm:"type:uuid;not null;index"`
	OrderID       *uuid.UUID `json:"order_id" gorm:"type:uuid;index"`
	Order         *Order     `json:"order,omitempty" gorm:"foreignKey:OrderID"`
	CustomerID    *uuid.UUID `json:"customer_id" gorm:"type:uuid;index"`
	PaymentNumber string     `json:"payment_number" gorm:"not null;size:50;uniqueIndex:idx_payment_number"`
	PaymentDate   time.Time  `json:"payment_date" gorm:"not null"`
	Amount        float64    `json:"amount" gorm:"type:decimal(18,4);not null"`
	CurrencyCode  string     `json:"currency_code" gorm:"size:3;default:'USD'"`
	Method        string     `json:"method" gorm:"size:50;not null"`
	Reference     string     `json:"reference" gorm:"size:200"`
	Notes         string     `json:"notes"`
	Status        string     `json:"status" gorm:"size:20;default:'completed'"`
}

func (Payment) TableName() string {
	return "payments"
}

type Invoice struct {
	models.BaseModel
	CompanyID     uuid.UUID     `json:"company_id" gorm:"type:uuid;not null;index"`
	BranchID      *uuid.UUID    `json:"branch_id" gorm:"type:uuid;index"`
	OrderID       *uuid.UUID    `json:"order_id" gorm:"type:uuid;index"`
	CustomerID    *uuid.UUID    `json:"customer_id" gorm:"type:uuid;index"`
	Customer      *Customer     `json:"customer,omitempty" gorm:"foreignKey:CustomerID"`
	InvoiceNumber string        `json:"invoice_number" gorm:"not null;size:50;uniqueIndex:idx_invoice_number"`
	InvoiceDate   time.Time     `json:"invoice_date" gorm:"not null"`
	DueDate       time.Time     `json:"due_date" gorm:"not null"`
	Status        string        `json:"status" gorm:"size:20;default:'draft'"`
	Subtotal      float64       `json:"subtotal" gorm:"type:decimal(18,4);default:0"`
	TaxAmount     float64       `json:"tax_amount" gorm:"type:decimal(18,4);default:0"`
	TotalAmount   float64       `json:"total_amount" gorm:"type:decimal(18,4);default:0"`
	PaidAmount    float64       `json:"paid_amount" gorm:"type:decimal(18,4);default:0"`
	CurrencyCode  string        `json:"currency_code" gorm:"size:3;default:'USD'"`
	Notes         string        `json:"notes"`
	Items         []InvoiceItem `json:"items,omitempty" gorm:"foreignKey:InvoiceID"`
}

func (Invoice) TableName() string {
	return "invoices"
}

type InvoiceItem struct {
	models.BaseModel
	InvoiceID   uuid.UUID `json:"invoice_id" gorm:"type:uuid;not null;index"`
	ProductID   *uuid.UUID `json:"product_id" gorm:"type:uuid"`
	Description string    `json:"description" gorm:"not null;size:500"`
	Quantity    int       `json:"quantity" gorm:"not null;default:1"`
	UnitPrice   float64   `json:"unit_price" gorm:"type:decimal(18,4);not null"`
	TaxRate     float64   `json:"tax_rate" gorm:"type:decimal(5,2);default:0"`
	TaxAmount   float64   `json:"tax_amount" gorm:"type:decimal(18,4);default:0"`
	TotalAmount float64   `json:"total_amount" gorm:"type:decimal(18,4);not null"`
	LineNumber  int       `json:"line_number" gorm:"not null"`
}

func (InvoiceItem) TableName() string {
	return "invoice_items"
}
