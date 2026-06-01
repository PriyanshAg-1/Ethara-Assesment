import { useEffect, useState } from 'react';

import { api } from './services/api.js';

const emptyProduct = { name: '', sku: '', price: '', quantity_in_stock: '' };
const emptyCustomer = { full_name: '', email: '', phone_number: '' };
const sections = ['dashboard', 'products', 'customers', 'orders'];

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value || 0));
}

function dateTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState(null);
  const [customerForm, setCustomerForm] = useState(emptyCustomer);
  const [orderCustomerId, setOrderCustomerId] = useState('');
  const [orderItems, setOrderItems] = useState([{ product_id: '', quantity: 1 }]);
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refreshData() {
    const [summaryData, productData, customerData, orderData] = await Promise.all([
      api.getSummary(),
      api.listProducts(),
      api.listCustomers(),
      api.listOrders(),
    ]);
    setSummary(summaryData);
    setProducts(productData);
    setCustomers(customerData);
    setOrders(orderData);
  }

  async function runAction(action, successMessage) {
    setMessage(null);
    try {
      await action();
      await refreshData();
      setMessage({ type: 'success', text: successMessage });
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  useEffect(() => {
    refreshData()
      .catch((error) => setMessage({ type: 'error', text: error.message }))
      .finally(() => setIsLoading(false));
  }, []);

  const lowStockProducts = products.filter((product) => product.quantity_in_stock <= 5);

  function updateOrderItem(index, field, value) {
    setOrderItems((items) => items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item)));
  }

  function productPayload() {
    return {
      name: productForm.name,
      sku: productForm.sku,
      price: Number(productForm.price),
      quantity_in_stock: Number(productForm.quantity_in_stock),
    };
  }

  function resetProductForm() {
    setProductForm(emptyProduct);
    setEditingProductId(null);
  }

  function selectProductForEdit(product) {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity_in_stock: product.quantity_in_stock,
    });
    setActiveSection('products');
  }

  async function submitProduct(event) {
    event.preventDefault();
    await runAction(async () => {
      if (editingProductId) {
        await api.updateProduct(editingProductId, productPayload());
      } else {
        await api.createProduct(productPayload());
      }
      resetProductForm();
    }, editingProductId ? 'Product updated' : 'Product added');
  }

  async function submitCustomer(event) {
    event.preventDefault();
    await runAction(async () => {
      await api.createCustomer(customerForm);
      setCustomerForm(emptyCustomer);
    }, 'Customer added');
  }

  async function submitOrder(event) {
    event.preventDefault();
    const payload = {
      customer_id: Number(orderCustomerId),
      items: orderItems
        .filter((item) => item.product_id && Number(item.quantity) > 0)
        .map((item) => ({ product_id: Number(item.product_id), quantity: Number(item.quantity) })),
    };

    await runAction(async () => {
      const order = await api.createOrder(payload);
      setSelectedOrder(order);
      setOrderCustomerId('');
      setOrderItems([{ product_id: '', quantity: 1 }]);
    }, 'Order created and stock reduced');
  }

  async function viewOrder(id) {
    try {
      setSelectedOrder(await api.getOrder(id));
      setActiveSection('orders');
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="eyebrow">Ethara Ops</span>
          <h1>Inventory Command</h1>
          <p>Products, customers, and orders in one controlled workflow.</p>
        </div>
        <nav className="nav-list" aria-label="Application sections">
          {sections.map((section) => (
            <button
              className={activeSection === section ? 'active' : ''}
              key={section}
              onClick={() => setActiveSection(section)}
              type="button"
            >
              {section}
            </button>
          ))}
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Live Control Panel</span>
            <h2>{activeSection}</h2>
          </div>
          <button className="ghost-button" onClick={() => refreshData()} type="button">Refresh</button>
        </header>

        {message && <div className={`notice ${message.type}`}>{message.text}</div>}
        {isLoading ? <div className="panel">Loading inventory workspace...</div> : null}

        {!isLoading && activeSection === 'dashboard' && (
          <section className="content-grid dashboard-grid">
            <div className="metric-card ink">
              <span>Total Products</span>
              <strong>{summary?.total_products ?? 0}</strong>
            </div>
            <div className="metric-card brass">
              <span>Total Customers</span>
              <strong>{summary?.total_customers ?? 0}</strong>
            </div>
            <div className="metric-card oxide">
              <span>Total Orders</span>
              <strong>{summary?.total_orders ?? 0}</strong>
            </div>
            <div className="metric-card warning">
              <span>Low Stock</span>
              <strong>{summary?.low_stock_products ?? 0}</strong>
            </div>
            <div className="panel wide-panel">
              <div className="panel-heading">
                <h3>Low stock watchlist</h3>
                <span>threshold: 5 units</span>
              </div>
              {lowStockProducts.length === 0 ? <p>No low stock products.</p> : null}
              <div className="watchlist">
                {lowStockProducts.map((product) => (
                  <button key={product.id} onClick={() => selectProductForEdit(product)} type="button">
                    <span>{product.name}</span>
                    <strong>{product.quantity_in_stock} left</strong>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {!isLoading && activeSection === 'products' && (
          <section className="split-layout">
            <form className="panel form-panel" onSubmit={submitProduct}>
              <div className="panel-heading">
                <h3>{editingProductId ? 'Update product' : 'Add product'}</h3>
                {editingProductId && <button className="link-button" onClick={resetProductForm} type="button">Cancel edit</button>}
              </div>
              <label>
                Product name
                <input required value={productForm.name} onChange={(event) => setProductForm({ ...productForm, name: event.target.value })} />
              </label>
              <label>
                SKU/code
                <input required value={productForm.sku} onChange={(event) => setProductForm({ ...productForm, sku: event.target.value })} />
              </label>
              <label>
                Price
                <input min="0.01" required step="0.01" type="number" value={productForm.price} onChange={(event) => setProductForm({ ...productForm, price: event.target.value })} />
              </label>
              <label>
                Quantity in stock
                <input min="0" required type="number" value={productForm.quantity_in_stock} onChange={(event) => setProductForm({ ...productForm, quantity_in_stock: event.target.value })} />
              </label>
              <button className="primary-button" type="submit">{editingProductId ? 'Save product' : 'Add product'}</button>
            </form>

            <div className="panel table-panel">
              <div className="panel-heading">
                <h3>Products</h3>
                <span>{products.length} records</span>
              </div>
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr><th>Name</th><th>SKU</th><th>Price</th><th>Stock</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>{product.sku}</td>
                        <td>{money(product.price)}</td>
                        <td><span className={product.quantity_in_stock <= 5 ? 'pill danger' : 'pill'}>{product.quantity_in_stock}</span></td>
                        <td className="actions">
                          <button onClick={() => selectProductForEdit(product)} type="button">Edit</button>
                          <button onClick={() => runAction(() => api.deleteProduct(product.id), 'Product deleted')} type="button">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {!isLoading && activeSection === 'customers' && (
          <section className="split-layout">
            <form className="panel form-panel" onSubmit={submitCustomer}>
              <div className="panel-heading"><h3>Add customer</h3></div>
              <label>
                Full name
                <input required value={customerForm.full_name} onChange={(event) => setCustomerForm({ ...customerForm, full_name: event.target.value })} />
              </label>
              <label>
                Email address
                <input required type="email" value={customerForm.email} onChange={(event) => setCustomerForm({ ...customerForm, email: event.target.value })} />
              </label>
              <label>
                Phone number
                <input required value={customerForm.phone_number} onChange={(event) => setCustomerForm({ ...customerForm, phone_number: event.target.value })} />
              </label>
              <button className="primary-button" type="submit">Add customer</button>
            </form>

            <div className="panel table-panel">
              <div className="panel-heading">
                <h3>Customers</h3>
                <span>{customers.length} records</span>
              </div>
              <div className="responsive-table">
                <table>
                  <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Actions</th></tr></thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <td>{customer.full_name}</td>
                        <td>{customer.email}</td>
                        <td>{customer.phone_number}</td>
                        <td className="actions"><button onClick={() => runAction(() => api.deleteCustomer(customer.id), 'Customer deleted')} type="button">Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {!isLoading && activeSection === 'orders' && (
          <section className="split-layout orders-layout">
            <form className="panel form-panel" onSubmit={submitOrder}>
              <div className="panel-heading"><h3>Create order</h3></div>
              <label>
                Customer
                <select required value={orderCustomerId} onChange={(event) => setOrderCustomerId(event.target.value)}>
                  <option value="">Select customer</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}</option>)}
                </select>
              </label>
              <div className="order-lines">
                {orderItems.map((item, index) => (
                  <div className="order-line" key={`${index}-${item.product_id}`}>
                    <label>
                      Product
                      <select required value={item.product_id} onChange={(event) => updateOrderItem(index, 'product_id', event.target.value)}>
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{product.name} ({product.quantity_in_stock} in stock)</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Qty
                      <input min="1" required type="number" value={item.quantity} onChange={(event) => updateOrderItem(index, 'quantity', event.target.value)} />
                    </label>
                    {orderItems.length > 1 && <button className="line-remove" onClick={() => setOrderItems(orderItems.filter((_, itemIndex) => itemIndex !== index))} type="button">Remove</button>}
                  </div>
                ))}
              </div>
              <button className="ghost-button" onClick={() => setOrderItems([...orderItems, { product_id: '', quantity: 1 }])} type="button">Add product line</button>
              <button className="primary-button" type="submit">Create order</button>
            </form>

            <div className="panel table-panel">
              <div className="panel-heading">
                <h3>Orders</h3>
                <span>{orders.length} records</span>
              </div>
              <div className="responsive-table">
                <table>
                  <thead><tr><th>ID</th><th>Customer</th><th>Total</th><th>Created</th><th>Actions</th></tr></thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>#{order.id}</td>
                        <td>{order.customer.full_name}</td>
                        <td>{money(order.total_amount)}</td>
                        <td>{dateTime(order.created_at)}</td>
                        <td className="actions">
                          <button onClick={() => viewOrder(order.id)} type="button">View</button>
                          <button onClick={() => runAction(() => api.deleteOrder(order.id), 'Order cancelled and stock restored')} type="button">Cancel</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedOrder && (
                <div className="order-detail">
                  <div className="panel-heading">
                    <h3>Order #{selectedOrder.id}</h3>
                    <span>{selectedOrder.customer.full_name}</span>
                  </div>
                  {selectedOrder.items.map((item) => (
                    <div className="detail-row" key={item.id}>
                      <span>{item.product.name} x {item.quantity}</span>
                      <strong>{money(item.line_total)}</strong>
                    </div>
                  ))}
                  <div className="detail-total"><span>Total</span><strong>{money(selectedOrder.total_amount)}</strong></div>
                </div>
              )}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
