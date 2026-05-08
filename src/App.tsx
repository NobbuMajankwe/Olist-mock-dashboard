/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  LineChart,
  Line,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import ordersCsv from "./data/olist_orders_dataset.csv?raw";
import itemsCsv from "./data/olist_order_items_dataset.csv?raw";
import productsCsv from "./data/olist_products_dataset.csv?raw";
import reviewsCsv from "./data/olist_order_reviews_dataset.csv?raw";
import {
  Upload,
  Package,
  RotateCcw,
  AlertTriangle,
  Clock,
  TrendingUp,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

const COLORS = [
  "#2563eb",
  "#f97316",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#0891b2",
];

export default function OlistEcommerceDashboard() {
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [reviews, setReviews] = useState([]);

  const parseCsv = (file, setter) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setter(results.data),
    });
  };

  const resetToImportedData = () => {
    setOrders(parseCsvString(ordersCsv));
    setItems(parseCsvString(itemsCsv));
    setProducts(parseCsvString(productsCsv));
    setReviews(parseCsvString(reviewsCsv));
  };

  useEffect(() => {
    resetToImportedData();
  }, []);

  const mergedData = useMemo(() => {
    const orderMap = new Map(orders.map((o) => [o.order_id, o]));
    const productMap = new Map(products.map((p) => [p.product_id, p]));
    const reviewMap = new Map(reviews.map((r) => [r.order_id, r]));

    const completeItems = items.filter((item) => {
      const order = orderMap.get(item.order_id);
      const product = productMap.get(item.product_id);
      const review = reviewMap.get(item.order_id);

      return (
        item.order_id &&
        item.product_id &&
        item.price &&
        order?.order_purchase_timestamp &&
        product?.product_category_name &&
        review?.review_score
      );
    });

    return completeItems.map((item) => {
      const order = orderMap.get(item.order_id) || {};
      const product = productMap.get(item.product_id) || {};
      const review = reviewMap.get(item.order_id) || {};

      const price = Number(item.price || 0);
      const freight = Number(item.freight_value || 0);
      const reviewScore = Number(review.review_score || 0);

      const purchaseDate = order.order_purchase_timestamp
        ? new Date(order.order_purchase_timestamp)
        : null;
      const deliveredDate = order.order_delivered_customer_date
        ? new Date(order.order_delivered_customer_date)
        : null;
      const estimatedDate = order.order_estimated_delivery_date
        ? new Date(order.order_estimated_delivery_date)
        : null;

      const deliveryDelay =
        deliveredDate && estimatedDate
          ? Math.max(
              0,
              Math.ceil(
                (deliveredDate.getTime() - estimatedDate.getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0;

      const fraudRisk = price > 1000 || deliveryDelay > 10 || reviewScore === 1;
      const returnRisk = reviewScore > 0 && reviewScore <= 2;

      return {
        orderId: item.order_id,
        productId: item.product_id,
        category: product.product_category_name || "Unknown",
        price,
        freight,
        reviewScore,
        returnRisk,
        fraudRisk,
        deliveryDelay,
        purchaseMonth: purchaseDate
          ? `${purchaseDate.getFullYear()}-${String(
              purchaseDate.getMonth() + 1,
            ).padStart(2, "0")}`
          : "Unknown",
      };
    });
  }, [orders, items, products, reviews]);

  const kpis = useMemo(() => {
    const totalOrders = new Set(mergedData.map((d) => d.orderId)).size;
    const totalRevenue = mergedData.reduce(
      (sum, d) => sum + d.price + d.freight,
      0,
    );
    const returnRiskCount = mergedData.filter((d) => d.returnRisk).length;
    const fraudRiskCount = mergedData.filter((d) => d.fraudRisk).length;
    const avgDelay = mergedData.length
      ? mergedData.reduce((sum, d) => sum + d.deliveryDelay, 0) /
        mergedData.length
      : 0;

    return {
      totalOrders,
      totalRevenue,
      returnRate: mergedData.length
        ? (returnRiskCount / mergedData.length) * 100
        : 0,
      fraudRate: mergedData.length
        ? (fraudRiskCount / mergedData.length) * 100
        : 0,
      avgDelay,
    };
  }, [mergedData]);

  const salesByCategory = useMemo(() => {
    const grouped = {};
    mergedData.forEach((d) => {
      grouped[d.category] = (grouped[d.category] || 0) + d.price;
    });
    return Object.entries(grouped)
      .map(([category, revenue]) => ({
        category,
        revenue: Number((revenue as number).toFixed(2)),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [mergedData]);

  const returnRiskByCategory = useMemo(() => {
    const grouped = {};
    mergedData.forEach((d) => {
      if (!grouped[d.category])
        grouped[d.category] = { category: d.category, total: 0, returnRisk: 0 };
      grouped[d.category].total += 1;
      if (d.returnRisk) grouped[d.category].returnRisk += 1;
    });
    return Object.values(grouped)
      .map((d: any) => ({
        category: d.category,
        returnRate: Number(((d.returnRisk / d.total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.returnRate - a.returnRate)
      .slice(0, 8);
  }, [mergedData]);

  const monthlyOrders = useMemo(() => {
    const grouped = {};
    mergedData.forEach((d) => {
      grouped[d.purchaseMonth] = (grouped[d.purchaseMonth] || 0) + 1;
    });
    return Object.entries(grouped)
      .map(([month, orders]) => ({ month, orders }))
      .filter((d) => d.month !== "Unknown")
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [mergedData]);

  const delayByMonth = useMemo(() => {
    const grouped = {};
    mergedData.forEach((d) => {
      if (d.purchaseMonth === "Unknown") return;
      if (!grouped[d.purchaseMonth])
        grouped[d.purchaseMonth] = {
          month: d.purchaseMonth,
          totalDelay: 0,
          count: 0,
        };
      grouped[d.purchaseMonth].totalDelay += d.deliveryDelay;
      grouped[d.purchaseMonth].count += 1;
    });
    return Object.values(grouped)
      .map((d: any) => ({
        month: d.month,
        avgDelay: Number((d.totalDelay / d.count).toFixed(1)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [mergedData]);

  const riskSummary = useMemo(
    () => [
      {
        name: "Normal",
        value: mergedData.filter((d) => !d.fraudRisk && !d.returnRisk).length,
      },
      {
        name: "Return Risk",
        value: mergedData.filter((d) => d.returnRisk).length,
      },
      {
        name: "Fraud Risk",
        value: mergedData.filter((d) => d.fraudRisk).length,
      },
    ],
    [mergedData],
  );

  const uploadFields = [
    { label: "olist_orders_dataset.csv", setter: setOrders },
    { label: "olist_order_items_dataset.csv", setter: setItems },
    { label: "olist_products_dataset.csv", setter: setProducts },
    { label: "olist_order_reviews_dataset.csv", setter: setReviews },
  ];

  const hasData = mergedData.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-2xl backdrop-blur">
          <div className="relative p-8 text-white">
            <div className="absolute right-8 top-8 hidden rounded-full bg-blue-400/20 p-5 md:block">
              <Sparkles className="h-10 w-10 text-blue-100" />
            </div>
            <div className="max-w-3xl">
              <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm text-blue-100">
                <TrendingUp className="h-4 w-4" /> Decision Support Prototype
              </span>
              <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                E-commerce Operations Dashboard
              </h1>
              <p className="mt-3 text-base leading-7 text-blue-100">
                A colourful React dashboard built from the Olist dataset to
                support inventory monitoring, return-risk analysis, delivery
                performance, and anomaly detection.
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <StatusBadge label="Inventory" />
              <StatusBadge label="Returns" />
              <StatusBadge label="Fraud Risk" />
              <StatusBadge label="Delivery Trends" />
            </div>
          </div>
        </div>

        <Card className="rounded-3xl border-white/20 bg-white/95 shadow-xl">
          <CardContent className="p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-blue-100 p-2 text-blue-700">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Optional CSV Upload</h2>
                  <p className="text-sm text-slate-500">
                    The dashboard loads imported CSV files by default. Upload
                    files only if you want to override them.
                  </p>
                </div>
              </div>
              <Button onClick={resetToImportedData} variant="outline">
                Reset to Imported Data
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {uploadFields.map((field, index) => (
                <label
                  key={field.label}
                  className="rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-white to-slate-50 p-4 text-sm text-slate-700 transition hover:border-blue-400 hover:shadow-md"
                >
                  <span className="mb-2 flex items-center gap-2 font-medium">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs text-white">
                      {index + 1}
                    </span>
                    {field.label}
                  </span>
                  <input
                    type="file"
                    accept=".csv"
                    className="w-full text-xs"
                    onChange={(e) =>
                      e.target.files?.[0] &&
                      parseCsv(e.target.files[0], field.setter)
                    }
                  />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {!hasData ? (
          <Card className="rounded-3xl border-white/20 bg-white/95 shadow-xl">
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Package className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                Dashboard awaiting data
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                The dashboard is ready to use with imported Olist CSV files. You
                can still upload replacement files to test another dataset.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-5">
              <KpiCard
                color="blue"
                icon={<Package />}
                title="Orders"
                value={kpis.totalOrders.toLocaleString()}
                helper="Unique customer orders"
              />
              <KpiCard
                color="green"
                icon={<TrendingUp />}
                title="Revenue"
                value={`R ${kpis.totalRevenue.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}`}
                helper="Price + freight value"
              />
              <KpiCard
                color="orange"
                icon={<RotateCcw />}
                title="Return Risk"
                value={`${kpis.returnRate.toFixed(1)}%`}
                helper="Low review proxy"
              />
              <KpiCard
                color="red"
                icon={<ShieldAlert />}
                title="Fraud Risk"
                value={`${kpis.fraudRate.toFixed(1)}%`}
                helper="Proxy anomaly score"
              />
              <KpiCard
                color="purple"
                icon={<Clock />}
                title="Avg Delay"
                value={`${kpis.avgDelay.toFixed(1)} days`}
                helper="Delivery delay trend"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardChart
                title="Top Product Categories by Revenue"
                subtitle="Shows highest value product categories for operational prioritisation."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={salesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="category"
                      angle={-25}
                      textAnchor="end"
                      height={95}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="revenue"
                      fill="#2563eb"
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart
                title="Categories with Highest Return Risk"
                subtitle="Uses low review scores as a proxy for dissatisfaction and return likelihood."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={returnRiskByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="category"
                      angle={-25}
                      textAnchor="end"
                      height={95}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar
                      dataKey="returnRate"
                      fill="#f97316"
                      radius={[10, 10, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart
                title="Monthly Order Volume"
                subtitle="Tracks demand trends over time."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={monthlyOrders}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="orders"
                      fill="#93c5fd"
                      stroke="#2563eb"
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart
                title="Operational Risk Summary"
                subtitle="Compares normal records with return-risk and fraud-risk indicators."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie
                      data={riskSummary}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={105}
                      label
                    >
                      {riskSummary.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart
                title="Average Delivery Delay by Month"
                subtitle="Highlights fulfilment periods that may require operational attention."
              >
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={delayByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="avgDelay"
                      stroke="#dc2626"
                      strokeWidth={3}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </DashboardChart>

              <Card className="rounded-3xl border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl">
                <CardContent className="flex h-full min-h-[320px] flex-col justify-between p-6">
                  <div>
                    <div className="mb-4 inline-flex rounded-2xl bg-white/15 p-3">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-bold">
                      Decision Support Summary
                    </h2>
                    <p className="mt-3 text-blue-100">
                      The dashboard transforms raw e-commerce records into
                      visual decision cues for operational users.
                    </p>
                  </div>
                  <div className="mt-6 space-y-3 text-sm">
                    <SummaryLine
                      label="Most useful for"
                      value="Fast operational scanning"
                    />
                    <SummaryLine
                      label="Risk proxy"
                      value="Reviews + delivery delays + order value"
                    />
                    <SummaryLine
                      label="Research use"
                      value="Task-based dashboard evaluation"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-3xl border-white/20 bg-white/95 shadow-xl">
              <CardContent className="p-6">
                <h2 className="mb-2 text-xl font-bold">
                  Interpretation for Research Tasks
                </h2>
                <p className="mb-5 text-sm text-slate-500">
                  These cards can be used in the methodology section to justify
                  task design and dashboard evaluation.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <Insight
                    tone="blue"
                    title="Stock monitoring"
                    text="Use category revenue and order volume to identify high-demand products that may require restocking."
                  />
                  <Insight
                    tone="orange"
                    title="Return analysis"
                    text="Use low review scores as a proxy for dissatisfaction and possible return risk."
                  />
                  <Insight
                    tone="red"
                    title="Fraud/anomaly detection"
                    text="Use high-value orders, long delivery delays, and severe dissatisfaction as simple fraud-risk indicators."
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, title, value, helper, color }) {
  const styles = {
    blue: "from-blue-500 to-blue-700 text-blue-700 bg-blue-50",
    green: "from-emerald-500 to-green-700 text-emerald-700 bg-emerald-50",
    orange: "from-orange-500 to-amber-600 text-orange-700 bg-orange-50",
    red: "from-red-500 to-rose-700 text-red-700 bg-red-50",
    purple: "from-purple-500 to-indigo-700 text-purple-700 bg-purple-50",
  };

  const [gradient, textColor, bgColor] = styles[color].split(" ");

  return (
    <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-xl">
      <CardContent className="p-0">
        <div className={`h-2 bg-gradient-to-r ${gradient} ${textColor}`} />
        <div className="p-5">
          <div
            className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${bgColor} ${textColor}`}
          >
            {icon}
          </div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardChart({ title, subtitle, children }) {
  return (
    <Card className="rounded-3xl border-0 bg-white shadow-xl">
      <CardContent className="p-6">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mb-4 text-sm text-slate-500">{subtitle}</p>
        {children}
      </CardContent>
    </Card>
  );
}

function Insight({ title, text, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    orange: "bg-orange-50 text-orange-700 border-orange-100",
    red: "bg-red-50 text-red-700 border-red-100",
  };

  return (
    <div className={`rounded-2xl border p-5 ${tones[tone]}`}>
      <h3 className="font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function StatusBadge({ label }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-blue-50 backdrop-blur">
      {label}
    </span>
  );
}

function parseCsvString(csvString) {
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data;
}

function SummaryLine({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-blue-100">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
