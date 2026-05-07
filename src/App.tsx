import /* React, */ { useMemo, useState } from "react";
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
  //Cell,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Package, RotateCcw, AlertTriangle, Clock } from "lucide-react";

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

  const mergedData = useMemo(() => {
    const orderMap = new Map(orders.map((o) => [o.order_id, o]));
    const productMap = new Map(products.map((p) => [p.product_id, p]));
    const reviewMap = new Map(reviews.map((r) => [r.order_id, r]));

    return items.map((item) => {
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

      const deliveryDelay = deliveredDate && estimatedDate
        ? Math.max(0, Math.ceil((deliveredDate.getTime() - estimatedDate.getTime()) / (1000 * 60 * 60 * 24)))
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
          ? `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, "0")}`
          : "Unknown",
      };
    });
  }, [orders, items, products, reviews]);

  const kpis = useMemo(() => {
    const totalOrders = new Set(mergedData.map((d) => d.orderId)).size;
    const totalRevenue = mergedData.reduce((sum, d) => sum + d.price + d.freight, 0);
    const returnRiskCount = mergedData.filter((d) => d.returnRisk).length;
    const fraudRiskCount = mergedData.filter((d) => d.fraudRisk).length;
    const avgDelay = mergedData.length
      ? mergedData.reduce((sum, d) => sum + d.deliveryDelay, 0) / mergedData.length
      : 0;

    return {
      totalOrders,
      totalRevenue,
      returnRate: mergedData.length ? (returnRiskCount / mergedData.length) * 100 : 0,
      fraudRate: mergedData.length ? (fraudRiskCount / mergedData.length) * 100 : 0,
      avgDelay,
    };
  }, [mergedData]);

  const salesByCategory = useMemo(() => {
    const grouped = {};
    mergedData.forEach((d) => {
      grouped[d.category] = ((grouped[d.category] as number) || 0) + d.price;
    });
    return Object.entries(grouped)
      .map(([category, revenue]) => ({ category, revenue: Number((revenue as number).toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [mergedData]);

  const returnRiskByCategory = useMemo(() => {
    const grouped = {};
    mergedData.forEach((d) => {
      if (!grouped[d.category]) grouped[d.category] = { category: d.category, total: 0, returnRisk: 0 };
      grouped[d.category].total += 1;
      if (d.returnRisk) grouped[d.category].returnRisk += 1;
    });
    return Object.values(grouped)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((d: any ) => ({
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

  const riskSummary = useMemo(() => [
    { name: "Normal", value: mergedData.filter((d) => !d.fraudRisk && !d.returnRisk).length },
    { name: "Return Risk", value: mergedData.filter((d) => d.returnRisk).length },
    { name: "Fraud Risk", value: mergedData.filter((d) => d.fraudRisk).length },
  ], [mergedData]);

  const uploadFields = [
    { label: "olist_orders_dataset.csv", setter: setOrders },
    { label: "olist_order_items_dataset.csv", setter: setItems },
    { label: "olist_products_dataset.csv", setter: setProducts },
    { label: "olist_order_reviews_dataset.csv", setter: setReviews },
  ];

  const hasData = mergedData.length > 0;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              E-commerce Operations Dashboard
            </h1>
            <p className="text-slate-600">
              Olist dataset prototype for inventory, returns, delivery, and anomaly decision support.
            </p>
          </div>
          <Button onClick={() => window.location.reload()} variant="outline">
            Reset Dashboard
          </Button>
        </div>

        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Upload Olist CSV Files</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {uploadFields.map((field) => (
                <label key={field.label} className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-700">
                  <span className="mb-2 block font-medium">{field.label}</span>
                  <input
                    type="file"
                    accept=".csv"
                    className="w-full text-xs"
                    onChange={(e) => e.target.files?.[0] && parseCsv(e.target.files[0], field.setter)}
                  />
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {!hasData ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-10 text-center text-slate-600">
              Upload the four Olist CSV files to generate the dashboard charts.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-5">
              <KpiCard icon={<Package />} title="Orders" value={kpis.totalOrders.toLocaleString()} />
              <KpiCard icon={<Package />} title="Revenue" value={`R ${kpis.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
              <KpiCard icon={<RotateCcw />} title="Return Risk" value={`${kpis.returnRate.toFixed(1)}%`} />
              <KpiCard icon={<AlertTriangle />} title="Fraud Risk" value={`${kpis.fraudRate.toFixed(1)}%`} />
              <KpiCard icon={<Clock />} title="Avg Delay" value={`${kpis.avgDelay.toFixed(1)} days`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <DashboardChart title="Top Product Categories by Revenue">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesByCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-25} textAnchor="end" height={90} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="revenue" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart title="Categories with Highest Return Risk">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={returnRiskByCategory}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" angle={-25} textAnchor="end" height={90} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="returnRate" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart title="Monthly Order Volume">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyOrders}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="orders" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </DashboardChart>

              <DashboardChart title="Operational Risk Summary">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={riskSummary} dataKey="value" nameKey="name" outerRadius={100} label />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </DashboardChart>
            </div>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-5">
                <h2 className="mb-3 text-lg font-semibold">Interpretation for Research Tasks</h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <Insight title="Stock monitoring" text="Use category revenue and order volume to identify high-demand products that may require restocking." />
                  <Insight title="Return analysis" text="Use low review scores as a proxy for dissatisfaction and possible return risk." />
                  <Insight title="Fraud/anomaly detection" text="Use high-value orders, long delivery delays, and severe dissatisfaction as simple fraud-risk indicators." />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, title, value }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          {icon}
        </div>
        <p className="text-sm text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardChart({ title, children }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-5">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </CardContent>
    </Card>
  );
}

function Insight({ title, text }) {
  return (
    <div className="rounded-xl bg-slate-100 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}
