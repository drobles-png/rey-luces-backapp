import { Order } from "../models/order.model";
import { User } from "../models/user.model";
import { escapeRegex } from "../utils/objectId";
import { activeCountsByUser, countActive } from "./access.service";

export async function stats() {
  const [students, activeAccesses, paid] = await Promise.all([
    User.countDocuments({ accountType: "customer" }),
    countActive(),
    Order.aggregate<{ count: number; revenue: number }>([
      { $match: { status: "paid" } },
      { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$totalCents" } } },
    ]),
  ]);
  return {
    students,
    activeAccesses,
    paidOrders: paid[0]?.count ?? 0,
    revenueCents: paid[0]?.revenue ?? 0,
  };
}

export async function listStudents(query: { q?: unknown; page?: unknown }) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = 20;
  const filter: Record<string, unknown> = { accountType: "customer" };
  const q = String(query.q ?? "").trim();
  if (q) {
    const re = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ email: re }, { name: re }, { phone: re }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .select("email name phone createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<any[]>(),
    User.countDocuments(filter),
  ]);
  const counts = await activeCountsByUser(users.map((u) => u._id));

  return {
    items: users.map((u) => ({
      _id: String(u._id),
      email: u.email,
      name: u.name ?? "",
      phone: u.phone ?? "",
      createdAt: u.createdAt,
      activeAccesses: counts.get(String(u._id)) ?? 0,
    })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
