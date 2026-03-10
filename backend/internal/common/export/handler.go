package export

import (
	"bytes"
	"fmt"

	"github.com/gofiber/fiber/v2"
)

type Column struct {
	Header string
	Field  string
	Width  float64
}

func HandleExport(c *fiber.Ctx, title string, columns []Column, data interface{}) error {
	format := c.Query("format", "excel")

	if format == "pdf" {
		pdfCols := make([]PDFColumn, len(columns))
		for i, col := range columns {
			pdfCols[i] = PDFColumn{Header: col.Header, Field: col.Field, Width: col.Width}
		}

		pdf, err := GeneratePDF(PDFOptions{Title: title, Orientation: "L", PageSize: "A4"}, pdfCols, data)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate PDF"})
		}

		var buf bytes.Buffer
		if err := pdf.Output(&buf); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to write PDF"})
		}

		c.Set("Content-Type", "application/pdf")
		c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.pdf", title))
		return c.Send(buf.Bytes())
	}

	excelCols := make([]ExcelColumn, len(columns))
	for i, col := range columns {
		excelCols[i] = ExcelColumn{Header: col.Header, Field: col.Field, Width: col.Width}
	}

	f, err := GenerateExcel(title, excelCols, data)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to generate Excel"})
	}

	var buf bytes.Buffer
	if err := f.Write(&buf); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to write Excel"})
	}

	c.Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.xlsx", title))
	return c.Send(buf.Bytes())
}
