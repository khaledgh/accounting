package service

import (
	"encoding/json"
	"fmt"
	"time"

	accModels "github.com/gonext/accounting-ecommerce/internal/accounting/models"
	"github.com/gonext/accounting-ecommerce/internal/common/autonumber"
	ecomModels "github.com/gonext/accounting-ecommerce/internal/ecommerce/models"
	intModels "github.com/gonext/accounting-ecommerce/internal/integration/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type IntegrationService struct {
	db      *gorm.DB
	autoNum *autonumber.Service
}

func NewIntegrationService(db *gorm.DB, autoNum *autonumber.Service) *IntegrationService {
	return &IntegrationService{db: db, autoNum: autoNum}
}

func (s *IntegrationService) ProcessOrderEvent(companyID uuid.UUID, eventType intModels.EventType, order *ecomModels.Order) error {
	var mapping intModels.AccountMapping
	err := s.db.Where("company_id = ? AND event_type = ? AND is_active = ?", companyID, eventType, true).First(&mapping).Error
	if err != nil {
		return s.logEvent(companyID, eventType, order.ID, "order", nil, "skipped", "No active mapping found for event: "+string(eventType))
	}

	var activeFY accModels.FinancialYear
	now := time.Now()
	err = s.db.Where("company_id = ? AND is_active = ? AND is_closed = ? AND start_date <= ? AND end_date >= ?",
		companyID, true, false, now, now).First(&activeFY).Error
	if err != nil {
		return s.logEvent(companyID, eventType, order.ID, "order", nil, "failed", "No active financial year found")
	}

	number, err := s.autoNum.GenerateNumber(companyID, nil, "journal")
	if err != nil {
		return s.logEvent(companyID, eventType, order.ID, "order", nil, "failed", "Failed to generate journal number: "+err.Error())
	}

	description := fmt.Sprintf("Auto: %s - Order %s", eventType, order.OrderNumber)
	if mapping.Description != "" {
		description = fmt.Sprintf("%s - Order %s", mapping.Description, order.OrderNumber)
	}

	amount := order.TotalAmount

	tx := s.db.Begin()

	journal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: activeFY.ID,
		Number:          number,
		Date:            now,
		Reference:       order.OrderNumber,
		Description:     description,
		Status:          accModels.JournalStatusPosted,
		TotalDebit:      amount,
		TotalCredit:     amount,
		CurrencyCode:    order.CurrencyCode,
		ExchangeRate:    1,
		Source:          string(eventType),
		SourceID:        &order.ID,
	}
	posted := now
	journal.PostedAt = &posted

	var period accModels.FiscalPeriod
	if err := s.db.Where("financial_year_id = ? AND start_date <= ? AND end_date >= ?", activeFY.ID, now, now).First(&period).Error; err == nil {
		journal.FiscalPeriodID = &period.ID
	}

	if err := tx.Create(&journal).Error; err != nil {
		tx.Rollback()
		return s.logEvent(companyID, eventType, order.ID, "order", nil, "failed", "Failed to create journal: "+err.Error())
	}

	debitEntry := accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    mapping.DebitAccountID,
		Description:  description,
		DebitAmount:  amount,
		CreditAmount: 0,
		CurrencyCode: order.CurrencyCode,
		ExchangeRate: 1,
		BaseDebit:    amount,
		BaseCredit:   0,
		LineNumber:   1,
	}
	if err := tx.Create(&debitEntry).Error; err != nil {
		tx.Rollback()
		return s.logEvent(companyID, eventType, order.ID, "order", nil, "failed", "Failed to create debit entry: "+err.Error())
	}

	creditEntry := accModels.JournalEntry{
		JournalID:    journal.ID,
		AccountID:    mapping.CreditAccountID,
		Description:  description,
		DebitAmount:  0,
		CreditAmount: amount,
		CurrencyCode: order.CurrencyCode,
		ExchangeRate: 1,
		BaseDebit:    0,
		BaseCredit:   amount,
		LineNumber:   2,
	}
	if err := tx.Create(&creditEntry).Error; err != nil {
		tx.Rollback()
		return s.logEvent(companyID, eventType, order.ID, "order", nil, "failed", "Failed to create credit entry: "+err.Error())
	}

	// Update account balances
	var debitAcc accModels.Account
	if err := tx.Where("id = ?", mapping.DebitAccountID).First(&debitAcc).Error; err == nil {
		if debitAcc.NormalBalance == "debit" {
			debitAcc.CurrentBalance += amount
		} else {
			debitAcc.CurrentBalance -= amount
		}
		tx.Save(&debitAcc)
	}

	var creditAcc accModels.Account
	if err := tx.Where("id = ?", mapping.CreditAccountID).First(&creditAcc).Error; err == nil {
		if creditAcc.NormalBalance == "credit" {
			creditAcc.CurrentBalance += amount
		} else {
			creditAcc.CurrentBalance -= amount
		}
		tx.Save(&creditAcc)
	}

	tx.Commit()

	return s.logEvent(companyID, eventType, order.ID, "order", &journal.ID, "success", "")
}

func (s *IntegrationService) ProcessPaymentEvent(companyID uuid.UUID, payment *ecomModels.Payment) error {
	eventType := intModels.EventPaymentReceived

	var mapping intModels.AccountMapping
	err := s.db.Where("company_id = ? AND event_type = ? AND is_active = ?", companyID, eventType, true).First(&mapping).Error
	if err != nil {
		return s.logEvent(companyID, eventType, payment.ID, "payment", nil, "skipped", "No active mapping found")
	}

	var activeFY accModels.FinancialYear
	now := time.Now()
	err = s.db.Where("company_id = ? AND is_active = ? AND is_closed = ? AND start_date <= ? AND end_date >= ?",
		companyID, true, false, now, now).First(&activeFY).Error
	if err != nil {
		return s.logEvent(companyID, eventType, payment.ID, "payment", nil, "failed", "No active financial year")
	}

	number, err := s.autoNum.GenerateNumber(companyID, nil, "journal")
	if err != nil {
		return s.logEvent(companyID, eventType, payment.ID, "payment", nil, "failed", "Failed to generate journal number")
	}

	description := fmt.Sprintf("Auto: Payment %s received", payment.PaymentNumber)

	tx := s.db.Begin()

	journal := accModels.Journal{
		CompanyID:       companyID,
		FinancialYearID: activeFY.ID,
		Number:          number,
		Date:            now,
		Reference:       payment.PaymentNumber,
		Description:     description,
		Status:          accModels.JournalStatusPosted,
		TotalDebit:      payment.Amount,
		TotalCredit:     payment.Amount,
		CurrencyCode:    payment.CurrencyCode,
		ExchangeRate:    1,
		Source:          string(eventType),
		SourceID:        &payment.ID,
	}
	posted := now
	journal.PostedAt = &posted

	if err := tx.Create(&journal).Error; err != nil {
		tx.Rollback()
		return s.logEvent(companyID, eventType, payment.ID, "payment", nil, "failed", err.Error())
	}

	tx.Create(&accModels.JournalEntry{
		JournalID: journal.ID, AccountID: mapping.DebitAccountID,
		Description: description, DebitAmount: payment.Amount, BaseDebit: payment.Amount,
		CurrencyCode: payment.CurrencyCode, ExchangeRate: 1, LineNumber: 1,
	})
	tx.Create(&accModels.JournalEntry{
		JournalID: journal.ID, AccountID: mapping.CreditAccountID,
		Description: description, CreditAmount: payment.Amount, BaseCredit: payment.Amount,
		CurrencyCode: payment.CurrencyCode, ExchangeRate: 1, LineNumber: 2,
	})

	tx.Commit()
	return s.logEvent(companyID, eventType, payment.ID, "payment", &journal.ID, "success", "")
}

func (s *IntegrationService) logEvent(companyID uuid.UUID, eventType intModels.EventType, sourceID uuid.UUID, sourceType string, journalID *uuid.UUID, status string, errMsg string) error {
	payload, _ := json.Marshal(map[string]interface{}{
		"source_id":   sourceID,
		"source_type": sourceType,
		"event_type":  eventType,
	})

	log := intModels.IntegrationLog{
		CompanyID:  companyID,
		EventType:  eventType,
		SourceID:   sourceID,
		SourceType: sourceType,
		JournalID:  journalID,
		Status:     status,
		ErrorMsg:   errMsg,
		Payload:    string(payload),
	}
	s.db.Create(&log)

	if status == "failed" {
		return fmt.Errorf("integration error: %s", errMsg)
	}
	return nil
}
