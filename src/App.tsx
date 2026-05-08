/* eslint-disable react-hooks/set-state-in-effect */
import React, { type ReactNode, useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  Package,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import ordersCsv from "./data/olist_orders_dataset.csv?raw";
import itemsCsv from "./data/olist_order_items_dataset.csv?raw";
import productsCsv from "./data/olist_products_dataset.csv?raw";
import reviewsCsv from "./data/olist_order_reviews_dataset.csv?raw";

const CHART_COLORS = ["#2563eb", "#f97316", "#16a34a", "#dc2626", "#9333ea", "#0891b2"];
const DELIVERY_DELAY_THRESHOLD = 10;
const HIGH_VALUE_THRESHOLD = 1000;
const HIGH_RETURN_RATE_THRESHOLD = 20;

type RawOrder = {
  order_id: string;
  order_purchase_timestamp?: string;
  order_delivered_customer_date?: string;
  order_estimated_delivery_date?: string;
};

type RawOrderItem = {
  order_id: string;
  product_id: string;
  price?: string;
  freight_value?: string;
};

type RawProduct = {
  product_id: string;
  product_category_name?: string;
};

type RawReview = {
  order_id: string;
  review_score?: string;
};

type DashboardRecord = {
  orderId: string;
  productId: string;
  category: string;
  price: number;
  freight: number;
  reviewScore: number;
  returnRisk: boolean;
  fraudRisk: boolean;
  deliveryDelay: number;
  purchaseMonth: string;
};

type AlertSeverity = "Stable" | "Warning" | "Attention" | "Critical";

type OperationalAlert = {
  title: string;
  value: number;
  severity: AlertSeverity;
  message: string;
};

export default function OlistEcommerceDashboard() {
  const [orders, setOrders] = useState<RawOrder[]>([]);
  const [items, setItems] = useState<RawOrderItem[]>([]);
  const [products, setProducts] = useState<RawProduct[]>([]);
  const [reviews, setReviews] = useState<RawReview[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRisk, setSelectedRisk] = useState("All");

  const resetToImportedData = () => {
    setOrders(parseCsvString<RawOrder>(ordersCsv));
    setItems(parseCsvString<RawOrderItem>(itemsCsv));
    setProducts(parseCsvString<RawProduct>(productsCsv));
    setReviews(parseCsvString<RawReview>(reviewsCsv));
    setSelectedCategory("All");
    setSelectedRisk("All");
  };

  useEffect(() => {
    resetToImportedData();
  }, []);

  const parseUploadedCsv = <T,>(file: File, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
    Papa.parse<T>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => setter(results.data),
    });
  };

  const mergedData = useMemo<DashboardRecord[]>(() => {
    const orderMap = new Map(orders.map((order) => [order.order_id, order]));
    const productMap = new Map(products.map((product) => [product.product_id, product]));
    const reviewMap = new Map(reviews.map((review) => [review.order_id, review]));

    return items.map((item) => {
      const order = orderMap.get(item.order_id);
      const product = productMap.get(item.product_id);
      const review = reviewMap.get(item.order_id);

      const price = Number(item.price || 0);
      const freight = Number(item.freight_value || 0);
      const reviewScore = Number(review?.review_score || 0);

      const purchaseDate = toDate(order?.order_purchase_timestamp);
      const deliveredDate = toDate(order?.order_delivered_customer_date);
      const estimatedDate = toDate(order?.order_estimated_delivery_date);

      const deliveryDelay = deliveredDate && estimatedDate
        ? Math.max(0, Math.ceil((deliveredDate.getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      const returnRisk = reviewScore > 0 && reviewScore <= 2;
      const fraudRisk = price > HIGH_VALUE_THRESHOLD || deliveryDelay > DELIVERY_DELAY_THRESHOLD || reviewScore === 1;

      return {
        orderId: item.order_id,
        productId: item.product_id,
        category: product?.product_category_name || "Unknown",
        price,
        freight,
        reviewScore,
        returnRisk,
        fraudRisk,
        deliveryDelay,
        purchaseMonth: purchaseDate ? formatMonth(purchaseDate) : "Unknown",
      };
    });
  }, [orders, items, products, reviews]);

  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(mergedData.map((record) => record.category)))
      .filter(Boolean)
      .sort();

    return ["All", ...uniqueCategories];
  }, [mergedData]);

  const filteredData = useMemo(() => {
    return mergedData.filter((record) => {
      const categoryMatch = selectedCategory === "All" || record.category === selectedCategory;
      const riskMatch =
        selectedRisk === "All" ||
        (selectedRisk === "Normal" && !record.returnRisk && !record.fraudRisk && record.deliveryDelay <= DELIVERY_DELAY_THRESHOLD) ||
        (selectedRisk === "Return Risk" && record.returnRisk) ||
        (selectedRisk === "Fraud Risk" && record.fraudRisk) ||
        (selectedRisk === "Delivery Delay" && record.deliveryDelay > DELIVERY_DELAY_THRESHOLD);

      return categoryMatch && riskMatch;
    });
  }, [mergedData, selectedCategory, selectedRisk]);

  const kpis = useMemo(() => {
    const totalOrders = new Set(filteredData.map((record) => record.orderId)).size;
    const totalRevenue = filteredData.reduce((sum, record) => sum + record.price + record.freight, 0);
    const returnRiskCount = filteredData.filter((record) => record.returnRisk).length;
    const fraudRiskCount = filteredData.filter((record) => record.fraudRisk).length;
    const avgDelay = filteredData.length
      ? filteredData.reduce((sum, record) => sum + record.deliveryDelay, 0) / filteredData.length
      : 0;

    return {
      totalOrders,
      totalRevenue,
      returnRate: filteredData.length ? (returnRiskCount / filteredData.length) * 100 : 0,
      fraudRate: filteredData.length ? (fraudRiskCount / filteredData.length) * 100 : 0,
      avgDelay,
    };
  }, [filteredData]);

  const salesByCategory = useMemo(() => {
    const grouped: Record<string, number> = {};

    filteredData.forEach((record) => {
      grouped[record.category] = (grouped[record.category] || 0) + record.price;
    });

    return Object.entries(grouped)
      .map(([category, revenue]) => ({ category, revenue: Number(revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [filteredData]);

  const returnRiskByCategory = useMemo(() => {
    const grouped: Record<string, { category: string; total: number; returnRisk: number }> = {};

    filteredData.forEach((record) => {
      if (!grouped[record.category]) {
        grouped[record.category] = { category: record.category, total: 0, returnRisk: 0 };
      }

      grouped[record.category].total += 1;
      if (record.returnRisk) grouped[record.category].returnRisk += 1;
    });

    return Object.values(grouped)
      .map((record) => ({
        category: record.category,
        returnRate: Number(((record.returnRisk / record.total) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.returnRate - a.returnRate)
      .slice(0, 8);
  }, [filteredData]);

  const monthlyOrders = useMemo(() => {
    const grouped: Record<string, number> = {};

    filteredData.forEach((record) => {
      if (record.purchaseMonth === "Unknown") return;
      grouped[record.purchaseMonth] = (grouped[record.purchaseMonth] || 0) + 1;
    });

    return Object.entries(grouped)
      .map(([month, orders]) => ({ month, orders }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData]);

  const delayByMonth = useMemo(() => {
    const grouped: Record<string, { month: string; totalDelay: number; count: number }> = {};

    filteredData.forEach((record) => {
      if (record.purchaseMonth === "Unknown") return;

      if (!grouped[record.purchaseMonth]) {
        grouped[record.purchaseMonth] = { month: record.purchaseMonth, totalDelay: 0, count: 0 };
      }

      grouped[record.purchaseMonth].totalDelay += record.deliveryDelay;
      grouped[record.purchaseMonth].count += 1;
    });

    return Object.values(grouped)
      .map((record) => ({
        month: record.month,
        avgDelay: Number((record.totalDelay / record.count).toFixed(1)),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredData]);

  const riskSummary = useMemo(() => [
    {
      name: "Normal",
      value: filteredData.filter((record) => !record.fraudRisk && !record.returnRisk).length,
    },
    {
      name: "Return Risk",
      value: filteredData.filter((record) => record.returnRisk).length,
    },
    {
      name: "Fraud Risk",
      value: filteredData.filter((record) => record.fraudRisk).length,
    },
  ], [filteredData]);

  const operationalAlerts = useMemo<OperationalAlert[]>(() => {
    const highReturnCategories = returnRiskByCategory
      .filter((record) => record.returnRate >= HIGH_RETURN_RATE_THRESHOLD)
      .slice(0, 3);

    const delayedOrders = filteredData.filter((record) => record.deliveryDelay > DELIVERY_DELAY_THRESHOLD).length;
    const highValueOrders = filteredData.filter((record) => record.price > HIGH_VALUE_THRESHOLD).length;

    return [
      {
        title: "High return-risk categories",
        value: highReturnCategories.length,
        severity: highReturnCategories.length > 0 ? "Warning" : "Stable",
        message: highReturnCategories.length > 0
          ? `${highReturnCategories.map((record) => record.category).join(", ")} require review.`
          : "No major return-risk category detected.",
      },
      {
        title: "Delayed delivery risk",
        value: delayedOrders,
        severity: delayedOrders > 0 ? "Attention" : "Stable",
        message: delayedOrders > 0
          ? "Some orders exceeded the 10-day delay threshold."
          : "No severe delivery delay detected.",
      },
      {
        title: "High-value anomaly risk",
        value: highValueOrders,
        severity: highValueOrders > 0 ? "Critical" : "Stable",
        message: highValueOrders > 0
          ? "High-value orders should be reviewed as possible anomaly indicators."
          : "No high-value anomaly indicator detected.",
      },
    ];
  }, [filteredData, returnRiskByCategory]);

  const uploadFields = [
    { label: "olist_orders_dataset.csv", setter: setOrders as React.Dispatch<React.SetStateAction<unknown[]>> },
    { label: "olist_order_items_dataset.csv", setter: setItems as React.Dispatch<React.SetStateAction<unknown[]>> },
    { label: "olist_products_dataset.csv", setter: setProducts as React.Dispatch<React.SetStateAction<unknown[]>> },
    { label: "olist_order_reviews_dataset.csv", setter: setReviews as React.Dispatch<React.SetStateAction<unknown[]>> },
  ];

  const hasData = mergedData.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-6">
        <Header />

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
                    The dashboard loads imported CSV files by default. Upload files only if you want to override them.
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
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) parseUploadedCsv(file, field.setter);
                    }}
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
              <h2 className="text-2xl font-bold text-slate-900">Dashboard awaiting data</h2>
              <p className="mx-auto mt-2 max-w-xl text-slate-600">
                The dashboard is ready to use with imported Olist CSV files. You can still upload replacement files to test another dataset.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="rounded-3xl border-0 bg-white shadow-xl">
              <CardContent className="p-6">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Operational Alerts and Filters</h2>
                    <p className="text-sm text-slate-500">
                      Alerts improve rapid interpretation of operational data, while filtering and categorisation support efficient metric exploration.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <select
                      value={selectedCategory}
                      onChange={(event) => setSelectedCategory(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>{category}</option>
                      ))}
                    </select>

                    <select
                      value={selectedRisk}
                      onChange={(event) => setSelectedRisk(event.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm"
                    >
                      {["All", "Normal", "Return Risk", "Fraud Risk", "Delivery Delay"].map((risk) => (
                        <option key={risk} value={risk}>{risk}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {operationalAlerts.map((alert) => (
                    <OperationalAlertCard key={alert.title} alert={alert} />
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-5">
              <KpiCard color="blue" icon={<Package />} title="Orders" value={kpis.totalOrders.toLocaleString()} helper="Filtered unique orders" />
              <KpiCard color="green" icon={<TrendingUp />} title="Revenue" value={`R ${kpis.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} helper="Price + freight value" />
              <KpiCard color="orange" icon={<RotateCcw />} title="Return Risk" value={`${kpis.returnRate.toFixed(1)}%`} helper="Low review proxy" />
              <KpiCard color="red" icon={<ShieldAlert />} title="Fraud Risk" value={`${kpis.fraudRate.toFixed(1)}%`} helper="Proxy anomaly score" />
              <KpiCard color="purple" icon={<Clock />} title="Avg Delay" value={`${kpis.avgDelay.toFixed(1)} days`} helper="Delivery delay trend" />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardChart title="Top Product Categories by Revenue" subtitle="Shows highest value product categories for operational prioritisation.">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={salesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" angle={-25} textAnchor="end" height={95} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#2563eb" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart title="Categories with Highest Return Risk" subtitle="Uses low review scores as a proxy for dissatisfaction and return likelihood.">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={returnRiskByCategory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="category" angle={-25} textAnchor="end" height={95} tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="returnRate" fill="#f97316" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart title="Monthly Order Volume" subtitle="Tracks demand trends over time.">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={monthlyOrders}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="orders" fill="#93c5fd" stroke="#2563eb" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart title="Operational Risk Summary" subtitle="Compares normal records with return-risk and fraud-risk indicators.">
                <ResponsiveContainer width="100%" height={320}>
                  <PieChart>
                    <Pie data={riskSummary} dataKey="value" nameKey="name" outerRadius={105} label>
                      {riskSummary.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart title="Average Delivery Delay by Month" subtitle="Highlights fulfilment periods that may require operational attention.">
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={delayByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="avgDelay" stroke="#dc2626" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </DashboardChart>

              <Card className="rounded-3xl border-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl">
                <CardContent className="flex h-full min-h-[320px] flex-col justify-between p-6">
                  <div>
                    <div className="mb-4 inline-flex rounded-2xl bg-white/15 p-3">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-bold">Decision Support Summary</h2>
                    <p className="mt-3 text-blue-100">
                      The dashboard transforms raw e-commerce records into visual decision cues for operational users.
                    </p>
                  </div>
                  <div className="mt-6 space-y-3 text-sm">
                    <SummaryLine label="Most useful for" value="Fast operational scanning" />
                    <SummaryLine label="Risk proxy" value="Reviews + delivery delays + order value" />
                    <SummaryLine label="Research use" value="Task-based dashboard evaluation" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-3xl border-white/20 bg-white/95 shadow-xl">
              <CardContent className="p-6">
                <h2 className="mb-2 text-xl font-bold">Interpretation for Research Tasks</h2>
                <p className="mb-5 text-sm text-slate-500">
                  These cards can be used in the methodology section to justify task design and dashboard evaluation.
                </p>
                <div className="grid gap-4 md:grid-cols-3">
                  <Insight tone="blue" title="Stock monitoring" text="Use category revenue and order volume to identify high-demand products that may require restocking." />
                  <Insight tone="orange" title="Return analysis" text="Use low review scores as a proxy for dissatisfaction and possible return risk." />
                  <Insight tone="red" title="Fraud/anomaly detection" text="Use high-value orders, long delivery delays, and severe dissatisfaction as simple fraud-risk indicators." />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Header() {
  return (
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
            A React dashboard built from the Olist dataset to support inventory monitoring, return-risk analysis,
            delivery performance, operational alerts, and anomaly detection.
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <StatusBadge label="Inventory" />
          <StatusBadge label="Returns" />
          <StatusBadge label="Fraud Risk" />
          <StatusBadge label="Delivery Trends" />
          <StatusBadge label="Operational Alerts" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon, title, value, helper, color }: {
  icon: ReactNode;
  title: string;
  value: string;
  helper: string;
  color: "blue" | "green" | "orange" | "red" | "purple";
}) {
  const styles = {
    blue: { gradient: "from-blue-500 to-blue-700", text: "text-blue-700", bg: "bg-blue-50" },
    green: { gradient: "from-emerald-500 to-green-700", text: "text-emerald-700", bg: "bg-emerald-50" },
    orange: { gradient: "from-orange-500 to-amber-600", text: "text-orange-700", bg: "bg-orange-50" },
    red: { gradient: "from-red-500 to-rose-700", text: "text-red-700", bg: "bg-red-50" },
    purple: { gradient: "from-purple-500 to-indigo-700", text: "text-purple-700", bg: "bg-purple-50" },
  }[color];

  return (
    <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-xl">
      <CardContent className="p-0">
        <div className={`h-2 bg-gradient-to-r ${styles.gradient}`} />
        <div className="p-5">
          <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl ${styles.bg} ${styles.text}`}>
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

function OperationalAlertCard({ alert }: { alert: OperationalAlert }) {
  const styles: Record<AlertSeverity, string> = {
    Stable: "border-emerald-100 bg-emerald-50 text-emerald-700",
    Warning: "border-orange-100 bg-orange-50 text-orange-700",
    Attention: "border-blue-100 bg-blue-50 text-blue-700",
    Critical: "border-red-100 bg-red-50 text-red-700",
  };

  return (
    <div className={`rounded-2xl border p-5 ${styles[alert.severity]}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-bold">{alert.title}</h3>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold">
          {alert.severity}
        </span>
      </div>
      <p className="text-3xl font-bold">{alert.value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{alert.message}</p>
    </div>
  );
}

function DashboardChart({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
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

function Insight({ title, text, tone }: { title: string; text: string; tone: "blue" | "orange" | "red" }) {
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

function StatusBadge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm text-blue-50 backdrop-blur">
      {label}
    </span>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 px-4 py-3">
      <span className="text-blue-100">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function parseCsvString<T>(csvString: string): T[] {
  const result = Papa.parse<T>(csvString, {
    header: true,
    skipEmptyLines: true,
  });

  return result.data;
}

function toDate(value?: string) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
