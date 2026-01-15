
import { useEffect, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import { Grid, Paper, Typography, Box } from '@mui/material';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, Legend
} from 'recharts';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { dashboardService, DashboardStats } from '../services/dashboard';
import LoadingOverlay from '../components/LoadingOverlay';
import { useTranslation } from 'react-i18next';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

import PageTransition from '../components/PageTransition';

import { motion } from 'framer-motion';
import { containerVariants, itemVariants } from '../utils/animations';

const Dashboard = () => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await dashboardService.getStats();
                setStats(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <LoadingOverlay open={true} />;
    if (!stats) return null;

    // 指标卡片辅助组件
    const MetricCard = ({ title, value, subtext, trend }: { title: string, value: string, subtext?: string, trend?: number }) => (
        <Paper
            elevation={3}
            sx={{
                p: 3,
                height: '100%',
                background: theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                color: theme.palette.text.primary,
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    {title}
                </Typography>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', my: 1, fontFamily: 'monospace' }}>
                    {value}
                </Typography>
                {trend !== undefined && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <Box
                            sx={{
                                display: 'flex', alignItems: 'center',
                                color: trend >= 0 ? theme.palette.success.main : theme.palette.error.main,
                                bgcolor: trend >= 0 ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
                                px: 1, py: 0.5, borderRadius: 1
                            }}
                        >
                            {trend >= 0 ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
                            <Typography variant="body2" fontWeight="bold">
                                {Math.abs(trend).toFixed(1)}%
                            </Typography>
                        </Box>
                        <Typography variant="caption" color="textSecondary">
                            {subtext}
                        </Typography>
                    </Box>
                )}
            </Box>
            {/* 装饰性背景圆圈 */}
            <Box
                sx={{
                    position: 'absolute',
                    right: -20,
                    top: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    bgcolor: theme.palette.primary.main,
                    opacity: 0.05,
                    zIndex: 0
                }}
            />
        </Paper>
    );

    return (
        <PageTransition>
            <Box sx={{ p: 3 }}>
                <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold' }}>
                    {t('dashboard')}
                </Typography>

                <Grid container spacing={3} component={motion.div} variants={containerVariants} initial="hidden" animate="visible">
                    {/* 1. 关键指标行 */}
                    <Grid size={{ xs: 12, md: 4 }} component={motion.div} variants={itemVariants}>
                        <MetricCard
                            title={t('dashboard_monthly_sales', 'Monthly Sales (Current)')}
                            value={`¥${stats.totalSales.toLocaleString()}`}
                            trend={stats.salesGrowthMoM}
                            subtext={t('dashboard_vs_last_month', 'vs Last Month')}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }} component={motion.div} variants={itemVariants}>
                        <MetricCard
                            title={t('dashboard_yoy_growth', 'YoY Growth')}
                            value={`${stats.salesGrowthYoY > 0 ? '+' : ''}${stats.salesGrowthYoY.toFixed(1)}%`}
                            subtext={t('dashboard_vs_same_month_last_year', 'vs Same Month Last Year')}
                            trend={stats.salesGrowthYoY}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }} component={motion.div} variants={itemVariants}>
                        <MetricCard
                            title={t('dashboard_active_projects', 'Active Projects (Top 5)')}
                            value={stats.topClients.length.toString()}
                            subtext={t('dashboard_contributing_projects', 'Projects contributing this year')}
                            trend={0}
                        />
                    </Grid>

                    {/* 2. 图表行 1：趋势与分布 */}
                    <Grid size={{ xs: 12, md: 8 }} component={motion.div} variants={itemVariants}>
                        <Paper sx={{ p: 3, borderRadius: 4, height: 400 }}>
                            <Typography variant="h6" gutterBottom>{t('dashboard_sales_trend', 'Sales Trend (Last 6 Months)')}</Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <LineChart data={stats.monthlyTrend}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                                    <XAxis dataKey="name" stroke={theme.palette.text.secondary} />
                                    <YAxis stroke={theme.palette.text.secondary} />
                                    <Tooltip
                                        formatter={(value: number | undefined) => [`¥${(value || 0).toLocaleString()}`, t('dashboard_monthly_sales', 'Sales')]}
                                        labelFormatter={(label) => `${label}`}
                                        contentStyle={{
                                            backgroundColor: theme.palette.background.paper,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: 8
                                        }}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="sales"
                                        stroke={theme.palette.primary.main}
                                        strokeWidth={3}
                                        dot={{ r: 4, fill: theme.palette.primary.main }}
                                        activeDot={{ r: 8 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }} component={motion.div} variants={itemVariants}>
                        <Paper sx={{ p: 3, borderRadius: 4, height: 400 }}>
                            <Typography variant="h6" gutterBottom>{t('dashboard_product_distribution', 'Product Sales Distribution')}</Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <PieChart>
                                    <Pie
                                        data={stats.productDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.productDistribution.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>

                    {/* 3. 顶级客户柱状图 */}
                    <Grid size={{ xs: 12 }} component={motion.div} variants={itemVariants}>
                        <Paper sx={{ p: 3, borderRadius: 4, height: 400 }}>
                            <Typography variant="h6" gutterBottom>{t('dashboard_top_projects', 'Top 5 Projects (Sub-clients) by Sales')}</Typography>
                            <ResponsiveContainer width="100%" height="90%">
                                <BarChart
                                    layout="vertical"
                                    data={stats.topClients}
                                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                                    <XAxis type="number" stroke={theme.palette.text.secondary} />
                                    <YAxis type="category" dataKey="name" width={100} stroke={theme.palette.text.secondary} />
                                    <Tooltip
                                        cursor={false}
                                        formatter={(value: number | undefined) => [`¥${(value || 0).toLocaleString()}`, t('dashboard_monthly_sales', 'Sales')]}
                                        contentStyle={{
                                            backgroundColor: theme.palette.background.paper,
                                            border: `1px solid ${theme.palette.divider}`,
                                            borderRadius: 8
                                        }}
                                    />
                                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </PageTransition>
    );
};

export default Dashboard;
