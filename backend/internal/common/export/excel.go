package export

import (
	"fmt"
	"reflect"

	"github.com/xuri/excelize/v2"
)

type ExcelColumn struct {
	Header string
	Field  string
	Width  float64
}

func GenerateExcel(sheetName string, columns []ExcelColumn, data interface{}) (*excelize.File, error) {
	f := excelize.NewFile()
	defer func() {
		if err := f.Close(); err != nil {
			fmt.Println("Error closing excel file:", err)
		}
	}()

	index, err := f.NewSheet(sheetName)
	if err != nil {
		return nil, err
	}
	f.SetActiveSheet(index)
	f.DeleteSheet("Sheet1")

	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 11, Color: "#FFFFFF"},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"#1F2937"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "left", Color: "#E5E7EB", Style: 1},
			{Type: "top", Color: "#E5E7EB", Style: 1},
			{Type: "bottom", Color: "#E5E7EB", Style: 1},
			{Type: "right", Color: "#E5E7EB", Style: 1},
		},
	})

	for i, col := range columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, col.Header)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)

		colName, _ := excelize.ColumnNumberToName(i + 1)
		width := col.Width
		if width == 0 {
			width = 15
		}
		f.SetColWidth(sheetName, colName, colName, width)
	}

	rv := reflect.ValueOf(data)
	if rv.Kind() == reflect.Ptr {
		rv = rv.Elem()
	}

	if rv.Kind() == reflect.Slice {
		for row := 0; row < rv.Len(); row++ {
			item := rv.Index(row)
			if item.Kind() == reflect.Ptr {
				item = item.Elem()
			}
			for col, column := range columns {
				cell, _ := excelize.CoordinatesToCellName(col+1, row+2)
				val := getFieldValue(item, column.Field)
				f.SetCellValue(sheetName, cell, val)
			}
		}
	}

	return f, nil
}

func getFieldValue(v reflect.Value, field string) interface{} {
	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return ""
		}
		v = v.Elem()
	}
	if v.Kind() != reflect.Struct {
		return ""
	}

	f := v.FieldByName(field)
	if !f.IsValid() {
		for i := 0; i < v.NumField(); i++ {
			tag := v.Type().Field(i).Tag.Get("json")
			if tag == field {
				f = v.Field(i)
				break
			}
		}
	}
	if !f.IsValid() {
		return ""
	}

	if f.Kind() == reflect.Ptr {
		if f.IsNil() {
			return ""
		}
		return f.Elem().Interface()
	}
	return f.Interface()
}
