package export

import (
	"fmt"
	"reflect"

	"github.com/jung-kurt/gofpdf"
)

type PDFColumn struct {
	Header string
	Field  string
	Width  float64
}

type PDFOptions struct {
	Title       string
	Orientation string
	PageSize    string
	FontSize    float64
	HeaderSize  float64
}

func GeneratePDF(options PDFOptions, columns []PDFColumn, data interface{}) (*gofpdf.Fpdf, error) {
	orientation := options.Orientation
	if orientation == "" {
		orientation = "L"
	}
	pageSize := options.PageSize
	if pageSize == "" {
		pageSize = "A4"
	}
	fontSize := options.FontSize
	if fontSize == 0 {
		fontSize = 9
	}
	headerSize := options.HeaderSize
	if headerSize == 0 {
		headerSize = 14
	}

	pdf := gofpdf.New(orientation, "mm", pageSize, "")
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()

	pdf.SetFont("Arial", "B", headerSize)
	pdf.CellFormat(0, 10, options.Title, "", 1, "C", false, 0, "")
	pdf.Ln(5)

	pdf.SetFont("Arial", "B", fontSize)
	pdf.SetFillColor(31, 41, 55)
	pdf.SetTextColor(255, 255, 255)

	for _, col := range columns {
		width := col.Width
		if width == 0 {
			width = 40
		}
		pdf.CellFormat(width, 8, col.Header, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	pdf.SetFont("Arial", "", fontSize)
	pdf.SetTextColor(0, 0, 0)
	pdf.SetFillColor(249, 250, 251)

	rv := reflect.ValueOf(data)
	if rv.Kind() == reflect.Ptr {
		rv = rv.Elem()
	}

	if rv.Kind() == reflect.Slice {
		for row := 0; row < rv.Len(); row++ {
			fill := row%2 == 0
			item := rv.Index(row)
			if item.Kind() == reflect.Ptr {
				item = item.Elem()
			}
			for _, col := range columns {
				width := col.Width
				if width == 0 {
					width = 40
				}
				val := fmt.Sprintf("%v", getFieldValue(item, col.Field))
				pdf.CellFormat(width, 7, val, "1", 0, "L", fill, 0, "")
			}
			pdf.Ln(-1)
		}
	}

	return pdf, nil
}
