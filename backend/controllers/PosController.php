<?php
/**
 * POS-specific reports: daily cash-register close (Z-report) and a GST summary.
 */
class PosController extends Controller
{
    /** Day-close / Z-report for a single date (defaults to today). */
    public function zReport(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $date = (string) $req->query('date', date('Y-m-d'));
        $db = Database::connection();

        // Sales summary for the day
        $s = $db->prepare(
            'SELECT COUNT(*) AS invoices,
                    COALESCE(SUM(subtotal),0)     AS gross,
                    COALESCE(SUM(discount),0)     AS discount,
                    COALESCE(SUM(tax),0)          AS tax,
                    COALESCE(SUM(total_amount),0) AS total,
                    COALESCE(SUM(paid_amount),0)  AS collected,
                    COALESCE(SUM(total_amount - paid_amount),0) AS dues
             FROM sales WHERE sale_date = ?'
        );
        $s->execute([$date]);
        $sales = $s->fetch();

        // Payment-mode breakdown (from sale_payments joined to that day's sales)
        $pm = $db->prepare(
            'SELECT sp.mode, COALESCE(SUM(sp.amount),0) AS amount, COUNT(*) AS cnt
             FROM sale_payments sp JOIN sales s ON s.id = sp.sale_id
             WHERE s.sale_date = ? GROUP BY sp.mode'
        );
        $pm->execute([$date]);
        $byMode = [];
        foreach ($pm->fetchAll() as $r) $byMode[$r['mode']] = ['amount' => (float) $r['amount'], 'count' => (int) $r['cnt']];
        foreach (['cash', 'upi', 'card', 'other'] as $m) $byMode[$m] = $byMode[$m] ?? ['amount' => 0, 'count' => 0];

        // Expenses for the day (total + cash portion for drawer reconciliation)
        $ex = $db->prepare(
            'SELECT COALESCE(SUM(amount),0) AS total,
                    COALESCE(SUM(CASE WHEN payment_mode = "cash" THEN amount ELSE 0 END),0) AS cash
             FROM expenses WHERE expense_date = ?'
        );
        $ex->execute([$date]);
        $expenses = $ex->fetch();

        // Top products sold that day
        $tp = $db->prepare(
            'SELECT p.name, SUM(si.quantity) AS qty, SUM(si.subtotal) AS amount
             FROM sale_items si JOIN sales s ON s.id = si.sale_id JOIN products p ON p.id = si.product_id
             WHERE s.sale_date = ? GROUP BY p.id ORDER BY qty DESC LIMIT 8'
        );
        $tp->execute([$date]);

        $expectedCash = $byMode['cash']['amount'] - (float) $expenses['cash'];

        Response::success([
            'date'           => $date,
            'sales'          => $sales,
            'by_mode'        => $byMode,
            'expenses'       => $expenses,
            'expected_cash'  => round($expectedCash, 2),
            'net_profit_est' => round((float) $sales['total'] - (float) $expenses['total'], 2),
            'top_products'   => $tp->fetchAll(),
        ]);
    }

    /** GST summary grouped by tax slab for a date range. */
    public function gstReport(Request $req): void
    {
        $this->authorize($req, ['Admin', 'Manager']);
        $from = (string) $req->query('from', date('Y-m-01'));
        $to   = (string) $req->query('to', date('Y-m-d'));
        $db = Database::connection();

        $stmt = $db->prepare(
            'SELECT tax_rate,
                    COUNT(*) AS invoices,
                    COALESCE(SUM(subtotal - discount),0) AS taxable,
                    COALESCE(SUM(tax),0) AS tax
             FROM sales
             WHERE sale_date BETWEEN ? AND ?
             GROUP BY tax_rate ORDER BY tax_rate ASC'
        );
        $stmt->execute([$from, $to]);
        $slabs = [];
        $totTaxable = 0; $totTax = 0; $totInv = 0;
        foreach ($stmt->fetchAll() as $r) {
            $tax = (float) $r['tax'];
            $slabs[] = [
                'tax_rate' => (float) $r['tax_rate'],
                'invoices' => (int) $r['invoices'],
                'taxable'  => (float) $r['taxable'],
                'cgst'     => round($tax / 2, 2),
                'sgst'     => round($tax / 2, 2),
                'total_tax'=> $tax,
            ];
            $totTaxable += (float) $r['taxable'];
            $totTax += $tax;
            $totInv += (int) $r['invoices'];
        }

        // B2B (named customer) vs B2C (walk-in / no customer) split
        $bb = $db->prepare(
            'SELECT CASE WHEN customer_id IS NULL THEN "B2C" ELSE "B2B" END AS kind,
                    COUNT(*) AS invoices, COALESCE(SUM(total_amount),0) AS total
             FROM sales WHERE sale_date BETWEEN ? AND ? GROUP BY kind'
        );
        $bb->execute([$from, $to]);

        Response::success([
            'from' => $from, 'to' => $to,
            'slabs' => $slabs,
            'totals' => [
                'invoices' => $totInv,
                'taxable'  => round($totTaxable, 2),
                'cgst'     => round($totTax / 2, 2),
                'sgst'     => round($totTax / 2, 2),
                'total_tax'=> round($totTax, 2),
            ],
            'b2b_b2c' => $bb->fetchAll(),
        ]);
    }
}
