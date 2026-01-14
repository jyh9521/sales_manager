
import { invoiceService } from './invoices';

export interface DashboardStats {
    totalSales: number;
    salesGrowthMoM: number;
    salesGrowthYoY: number;

    topClients: { name: string; value: number }[];
    productDistribution: { name: string; value: number }[];
    monthlyTrend: { name: string; sales: number }[]; // For charts (last 6-12 months)

    pendingInvoicesPoints: number; // Count of invoices
}

export const dashboardService = {
    async getStats(): Promise<DashboardStats> {
        const invoices = await invoiceService.getAll();

        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed

        // 1. Calculate Monthly Sales & Trends
        const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthKey = getMonthKey(now);

        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthKey = getMonthKey(lastMonthDate);

        const lastYearDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const lastYearKey = getMonthKey(lastYearDate);

        let currentMonthSales = 0;
        let lastMonthSales = 0;
        let lastYearSales = 0;

        // Simplify grouping for charts
        const monthlySalesMap = new Map<string, number>();

        // 2. Client (Project) Aggregation
        const clientSalesMap = new Map<string, number>();

        // 3. Product Aggregation
        const productSalesMap = new Map<string, number>();

        invoices.forEach(inv => {
            const date = new Date(inv.InvoiceDate);
            const key = getMonthKey(date);

            // Monthly Sales Grouping (for chart)
            const amount = inv.TotalAmount;
            monthlySalesMap.set(key, (monthlySalesMap.get(key) || 0) + amount);

            // KPIS
            if (key === currentMonthKey) currentMonthSales += amount;
            if (key === lastMonthKey) lastMonthSales += amount;
            if (key === lastYearKey) lastYearSales += amount;

            // Granular Analysis (Items)
            const items = inv.Items || [];
            items.forEach(item => {
                const itemTotal = item.Quantity * item.UnitPrice;

                // Top Clients (by Project)
                // Filter: Only count items from this year? Or all time? 
                // Usually dashboard shows current year or recent performance. 
                // Let's filter for Current Year to make it relevant.
                if (date.getFullYear() === currentYear) {
                    const project = item.Project || inv.ClientName || 'Unknown';
                    clientSalesMap.set(project, (clientSalesMap.get(project) || 0) + itemTotal);

                    const product = item.ProductName || 'Unknown';
                    productSalesMap.set(product, (productSalesMap.get(product) || 0) + itemTotal);
                }
            });
        });

        // Growth Rates
        const calculateGrowth = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const salesGrowthMoM = calculateGrowth(currentMonthSales, lastMonthSales);
        const salesGrowthYoY = calculateGrowth(currentMonthSales, lastYearSales);

        // Top Clients (Project) - Top 5
        const topClients = Array.from(clientSalesMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // Product Distribution - Top 5 + Others
        const sortedProducts = Array.from(productSalesMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        let productDistribution = sortedProducts;
        if (sortedProducts.length > 5) {
            const top = sortedProducts.slice(0, 5);
            const others = sortedProducts.slice(5).reduce((sum, item) => sum + item.value, 0);
            productDistribution = [...top, { name: 'Others', value: others }];
        }

        // Monthly Trend (Last 6 months)
        const monthlyTrend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const k = getMonthKey(d);
            monthlyTrend.push({
                name: k,
                sales: monthlySalesMap.get(k) || 0
            });
        }

        return {
            totalSales: currentMonthSales, // Main big number is THIS MONTH
            salesGrowthMoM,
            salesGrowthYoY,
            topClients,
            productDistribution,
            monthlyTrend,
            pendingInvoicesPoints: invoices.length // Just total count for now
        };
    }
};
