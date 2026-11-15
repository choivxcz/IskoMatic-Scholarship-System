$ErrorActionPreference = 'Stop'
$docPath = 'C:\Iskolar ng Bayan System\output\documents\IskoMatic_FinalDocu_With_Gantt.docx'
$pdfPath = 'C:\Iskolar ng Bayan System\output\documents\IskoMatic_FinalDocu_With_Gantt.pdf'
$wordApp = New-Object -ComObject Word.Application
$wordApp.Visible = $false
$wordApp.DisplayAlerts = 0
try {
    $wordDoc = $wordApp.Documents.Open($docPath, $false, $false)
    $wordDoc.Repaginate()
    [void]$wordDoc.Fields.Update()
    foreach ($toc in $wordDoc.TablesOfContents) { $toc.Update() }
    $wordDoc.Repaginate()
    foreach ($toc in $wordDoc.TablesOfContents) { $toc.UpdatePageNumbers() }
    $wordDoc.Save()
    $wordDoc.ExportAsFixedFormat($pdfPath, 17)
    Write-Output ('Pages: ' + $wordDoc.ComputeStatistics(2))
    $wordDoc.Close(0)
} finally {
    $wordApp.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wordApp)
}
