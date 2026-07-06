import { useCallback, useEffect, useState } from "react";
import { api, type OrderItem } from "@/lib/api";
import { mapApiTable, type Table } from "@/types/pos";

export interface OrderTab {
  id: string | null;
  orderNumber?: string | null;
  items: OrderItem[];
  sent: boolean;
  voidedAt?: string | null;
  voidedByName?: string | null;
}

function mapApiOrderToTab(o: {
  id: string;
  orderNumber?: string;
  voidedAt?: string | null;
  voidedByName?: string | null;
  items?: OrderItem[];
}): OrderTab {
  return {
    id: o.id,
    orderNumber: o.orderNumber ?? o.id,
    voidedAt: o.voidedAt ?? null,
    voidedByName: o.voidedByName ?? null,
    items: (o.items || []).map((item) => ({
      id: (item as { id?: string }).id,
      productId: item.productId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      subtotal: item.subtotal,
      department: item.department,
      isComplimentary: (item as { isComplimentary?: boolean }).isComplimentary,
      servedBy: (item as { servedBy?: string }).servedBy,
      servedByName: (item as { servedByName?: string }).servedByName,
      specialRequest: (item as { specialRequest?: string | null }).specialRequest ?? null,
      isVoided: (item as { isVoided?: boolean }).isVoided ?? false,
      voidedByName: (item as { voidedByName?: string | null }).voidedByName ?? null,
    })),
    sent: true,
  };
}

function tabsFromOrders(orders: Array<Parameters<typeof mapApiOrderToTab>[0]>): OrderTab[] {
  const tabs = orders.map(mapApiOrderToTab);
  return tabs.length > 0 ? [...tabs, { id: null, items: [], sent: false }] : [{ id: null, items: [], sent: false }];
}

export function useTableOrderSession(tableId: string | undefined) {
  const [table, setTable] = useState<Table | null>(null);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [orderTabs, setOrderTabs] = useState<OrderTab[]>([{ id: null, items: [], sent: false }]);
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const applySession = useCallback((session: { table: Table; orders: Array<Parameters<typeof mapApiOrderToTab>[0]> }) => {
    setTable(session.table);
    setOrderTabs(tabsFromOrders(session.orders));
    setActiveTabIndex(0);
  }, []);

  useEffect(() => {
    if (!tableId) {
      setTablesLoading(false);
      setTable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const session = await api.pos.tableSession(tableId);
        if (!cancelled) {
          applySession({
            table: mapApiTable(session.table),
            orders: session.orders,
          });
        }
      } catch {
        if (!cancelled) {
          try {
            const tablesRes = await api.dashboard.tables();
            const t = tablesRes.find((r) => r.id === tableId);
            if (t) {
              setTable(mapApiTable(t));
              const orderData = await api.orders.getByTable(tableId);
              setOrderTabs(tabsFromOrders(orderData.orders || []));
              setActiveTabIndex(0);
            } else {
              setTable(null);
            }
          } catch {
            setTable(null);
          }
        }
      } finally {
        if (!cancelled) setTablesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tableId, applySession]);

  const refetchOrders = useCallback(async () => {
    if (!tableId) return;
    try {
      const orderData = await api.orders.getByTable(tableId);
      setOrderTabs(tabsFromOrders(orderData.orders || []));
      setActiveTabIndex((idx) => Math.min(idx, Math.max(0, tabsFromOrders(orderData.orders || []).length - 1)));
    } catch {
      setOrderTabs([{ id: null, items: [], sent: false }]);
      setActiveTabIndex(0);
    }
  }, [tableId]);

  return {
    table,
    setTable,
    tablesLoading,
    orderTabs,
    setOrderTabs,
    activeTabIndex,
    setActiveTabIndex,
    refetchOrders,
  };
}
