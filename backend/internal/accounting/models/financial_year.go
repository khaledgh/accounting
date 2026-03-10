package models

import (
	"time"

	"github.com/gonext/accounting-ecommerce/internal/common/models"
	"github.com/google/uuid"
)

type FinancialYear struct {
	models.BaseModel
	CompanyID   uuid.UUID      `json:"company_id" gorm:"type:uuid;not null;index"`
	Name        string         `json:"name" gorm:"not null;size:100"`
	Code        string         `json:"code" gorm:"not null;size:20"`
	StartDate   time.Time      `json:"start_date" gorm:"not null"`
	EndDate     time.Time      `json:"end_date" gorm:"not null"`
	IsClosed    bool           `json:"is_closed" gorm:"default:false"`
	IsActive    bool           `json:"is_active" gorm:"default:true"`
	Periods     []FiscalPeriod `json:"periods,omitempty" gorm:"foreignKey:FinancialYearID"`
}

func (FinancialYear) TableName() string {
	return "financial_years"
}

type FiscalPeriod struct {
	models.BaseModel
	FinancialYearID uuid.UUID      `json:"financial_year_id" gorm:"type:uuid;not null;index"`
	FinancialYear   *FinancialYear `json:"financial_year,omitempty" gorm:"foreignKey:FinancialYearID"`
	Name            string         `json:"name" gorm:"not null;size:100"`
	Number          int            `json:"number" gorm:"not null"`
	StartDate       time.Time      `json:"start_date" gorm:"not null"`
	EndDate         time.Time      `json:"end_date" gorm:"not null"`
	IsClosed        bool           `json:"is_closed" gorm:"default:false"`
}

func (FiscalPeriod) TableName() string {
	return "fiscal_periods"
}
