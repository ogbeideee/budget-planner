$c = Get-Content 'C:/Users/dogbeide/BUDGET APP/budget-planner/vitest-diff.log'
$start = [Math]::Max(0, $c.Count - 55)
$c[$start..($c.Count-1)] -join [Environment]::NewLine