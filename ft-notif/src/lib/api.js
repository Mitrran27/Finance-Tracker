// const BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3000/api';

// function headers() {
//   const token = typeof localStorage !== 'undefined'
//     ? localStorage.getItem('token')
//     : null;

//   return {
//     'Content-Type': 'application/json',
//     ...(token ? { Authorization: `Bearer ${token}` } : {}),
//   };
// }

// async function handle(res) {
//   const data = await res.json();
//   if (!res.ok) throw new Error(data.error || 'Request failed');
//   return data;
// }

// export const api = {
//   get:    (path)       => fetch(`${BASE}${path}`, { headers: headers() }).then(handle),
//   post:   (path, body) => fetch(`${BASE}${path}`, { method: 'POST',   headers: headers(), body: JSON.stringify(body) }).then(handle),
//   patch:  (path, body) => fetch(`${BASE}${path}`, { method: 'PATCH',  headers: headers(), body: JSON.stringify(body) }).then(handle),
//   put:    (path, body) => fetch(`${BASE}${path}`, { method: 'PUT',    headers: headers(), body: JSON.stringify(body) }).then(handle),
//   delete: (path)       => fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() }).then(handle),
// };

const BASE = import.meta.env.PUBLIC_API_URL;

function headers() {
  const token = typeof localStorage !== 'undefined'
    ? localStorage.getItem('token')
    : null;

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handle(res) {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get:    (path)       => fetch(`${BASE}${path}`, { headers: headers() }).then(handle),
  post:   (path, body) => fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(handle),
  patch:  (path, body) => fetch(`${BASE}${path}`, { method: 'PATCH', headers: headers(), body: JSON.stringify(body) }).then(handle),
  put:    (path, body) => fetch(`${BASE}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(handle),
  delete: (path)       => fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() }).then(handle),
};