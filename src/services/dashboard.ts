
import { invoiceService } from './invoices';

export interface DashboardStats {
    totalSales: number;
    salesGrowthMoM: number;
    salesGrowthYoY: number;

    topClients: { name: string; value: number }[];
    productDistribution: { name: string; value: number }[];
    monthlyTrend: { name: string; sales: number }[]; // 用于图表 (最近 6-12 个月)

    pendingInvoicesPoints: number; // 发票数量
}

export const dashboardService = {
    async getStats(): Promise<DashboardStats> {
        const invoices = await invoiceService.getAll();

        const now = new Date();
        const currentYear = now.getFullYear();

        // 1. 计算月度销售额及趋势
        const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const currentMonthKey = getMonthKey(now);

        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthKey = getMonthKey(lastMonthDate);

        const lastYearDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        const lastYearKey = getMonthKey(lastYearDate);

        let currentMonthSales = 0;
        let lastMonthSales = 0;
        let lastYearSales = 0;

        // 简化图表分组
        const monthlySalesMap = new Map<string, number>();

        // 2. 客户 (项目) 聚合
        const clientSalesMap = new Map<string, number>();

        // 3. 产品聚合
        const productSalesMap = new Map<string, number>();

        invoices.forEach(inv => {
            const date = new Date(inv.InvoiceDate);
            const key = getMonthKey(date);

            // 月度销售分组 (用于图表)
            const amount = inv.TotalAmount;
            monthlySalesMap.set(key, (monthlySalesMap.get(key) || 0) + amount);

            // 关键绩效指标 (KPIs)
            if (key === currentMonthKey) currentMonthSales += amount;
            if (key === lastMonthKey) lastMonthSales += amount;
            if (key === lastYearKey) lastYearSales += amount;

            // 细粒度分析 (项目)
            const items = inv.Items || [];
            items.forEach(item => {
                const itemTotal = item.Quantity * item.UnitPrice;

                // 顶级客户 (按项目)
                // 筛选：仅计算今年的项目？还是所有时间？
                // 通常仪表盘显示当年或近期的表现。
                // 让我们筛选当年数据以使其更相关。
                if (date.getFullYear() === currentYear) {
                    const project = item.Project || inv.ClientName || 'Unknown';
                    clientSalesMap.set(project, (clientSalesMap.get(project) || 0) + itemTotal);

                    const product = item.ProductName || 'Unknown';
                    productSalesMap.set(product, (productSalesMap.get(product) || 0) + itemTotal);
                }
            });
        });

        // 增长率
        const calculateGrowth = (current: number, previous: number) => {
            if (previous === 0) return current > 0 ? 100 : 0;
            return ((current - previous) / previous) * 100;
        };

        const salesGrowthMoM = calculateGrowth(currentMonthSales, lastMonthSales);
        const salesGrowthYoY = calculateGrowth(currentMonthSales, lastYearSales);

        // 顶级客户 (项目) - 前 5 名
        const topClients = Array.from(clientSalesMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        // 产品分布 - 前 5 名 + 其他
        const sortedProducts = Array.from(productSalesMap.entries())
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        let productDistribution = sortedProducts;
        if (sortedProducts.length > 5) {
            const top = sortedProducts.slice(0, 5);
            const others = sortedProducts.slice(5).reduce((sum, item) => sum + item.value, 0);
            productDistribution = [...top, { name: 'Others', value: others }];
        }

        // 月度趋势 (最近 6 个月)
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
            totalSales: currentMonthSales, // 主要大数字是本月
            salesGrowthMoM,
            salesGrowthYoY,
            topClients,
            productDistribution,
            monthlyTrend,
            pendingInvoicesPoints: invoices.length // 目前仅为总计数
        };
    }
};
