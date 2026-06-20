import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/client';
import Loader from './Loader';

/**
 * Server-driven table with search, pagination and extra filters.
 *
 * props:
 *  - endpoint: API path (e.g. '/products')
 *  - columns: [{ key, label, render?(row), className? }]
 *  - filters: optional React node(s) rendered in the toolbar
 *  - query: extra query params object (status, category_id, ...)
 *  - toolbar: optional node rendered on the right (e.g. "Add" button)
 *  - refreshKey: change to force reload
 *  - searchable: bool (default true)
 *  - emptyText
 */
export default function DataTable({
  endpoint, columns, query = {}, toolbar, filters, refreshKey = 0,
  searchable = true, emptyText = 'No records found', perPage = 10,
  selectable = false, selectedIds = [], onSelectionChange,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, last_page: 1 });
  const [search, setSearch] = useState('');
  const debounce = useRef();

  // Clear selection when rows change to avoid stale ids
  useEffect(() => {
    if (selectable && selectedIds.length > 0 && onSelectionChange) {
      onSelectionChange([]);
    }
  }, [rows]);

  const queryStr = JSON.stringify(query);

  const load = useCallback(async (p = 1, s = '') => {
    setLoading(true);
    try {
      const { data } = await api.get(endpoint, {
        params: { page: p, per_page: perPage, search: s, ...JSON.parse(queryStr) },
      });
      setRows(data.data || []);
      setPagination(data.pagination || { total: (data.data || []).length, last_page: 1 });
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, perPage, queryStr]);

  useEffect(() => { load(page, search); /* eslint-disable-next-line */ }, [page, queryStr, refreshKey]);

  const onSearchChange = (val) => {
    setSearch(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPage(1);
      load(1, val);
    }, 350);
  };

  const { last_page = 1, total = 0 } = pagination;
  const pages = Array.from({ length: last_page }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === last_page || Math.abs(p - page) <= 2);

  return (
    <div className="sh-card">
      <div className="d-flex flex-wrap gap-2 align-items-center p-3 border-bottom">
        {searchable && (
          <div className="position-relative" style={{ maxWidth: 280 }}>
            <i className="bi bi-search position-absolute top-50 translate-middle-y ms-3 text-muted" style={{ zIndex: 5 }} />
            <input
              className="form-control ps-5 border-0 bg-light bg-light-focus"
              placeholder="Search..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{ borderRadius: '8px' }}
            />
          </div>
        )}
        {filters}
        <div className="ms-auto d-flex gap-2">{toolbar}</div>
      </div>

      <div className="table-responsive">
        <table className="sh-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: '40px' }} className="ps-3">
                  <input
                    type="checkbox"
                    className="form-check-input cursor-pointer"
                    checked={rows.length > 0 && selectedIds.length === rows.length}
                    onChange={(e) => {
                      if (onSelectionChange) {
                        onSelectionChange(e.target.checked ? rows.map((r) => r.id) : []);
                      }
                    }}
                  />
                </th>
              )}
              {columns.map((c, idx) => (
                <th key={c.key} className={`${c.className || ''} ${idx === 0 && selectable ? 'ps-1' : ''}`}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)}><Loader small /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center text-muted py-4">{emptyText}</td></tr>
            ) : (
              rows.map((row, i) => {
                const isSelected = selectedIds.includes(row.id);
                return (
                  <tr key={row.id ?? i} className={isSelected ? 'table-active' : ''}>
                    {selectable && (
                      <td className="ps-3">
                        <input
                          type="checkbox"
                          className="form-check-input cursor-pointer"
                          checked={isSelected}
                          onChange={(e) => {
                            if (onSelectionChange) {
                              if (e.target.checked) {
                                onSelectionChange([...selectedIds, row.id]);
                              } else {
                                onSelectionChange(selectedIds.filter((id) => id !== row.id));
                              }
                            }
                          }}
                        />
                      </td>
                    )}
                    {columns.map((c, idx) => (
                      <td key={c.key} className={`${c.className || ''} ${idx === 0 && selectable ? 'ps-2' : ''}`}>
                        {c.render ? c.render(row) : (row[c.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="d-flex flex-wrap gap-2 justify-content-between align-items-center p-3 border-top">
        <small className="text-muted">
          {total} record{total !== 1 ? 's' : ''} · page {page} of {last_page}
        </small>
        <div className="btn-group">
          <button className="btn btn-sm btn-outline-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <i className="bi bi-chevron-left" />
          </button>
          {pages.map((p, idx) => (
            <button
              key={p}
              className={`btn btn-sm ${p === page ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setPage(p)}
            >
              {idx > 0 && p - pages[idx - 1] > 1 ? `… ${p}` : p}
            </button>
          ))}
          <button className="btn btn-sm btn-outline-secondary" disabled={page >= last_page} onClick={() => setPage(page + 1)}>
            <i className="bi bi-chevron-right" />
          </button>
        </div>
      </div>
    </div>
  );
}
