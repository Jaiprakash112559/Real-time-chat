import React, { createContext, useState, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('chatUser');
    return stored ? JSON.parse(stored) : null;
  });

  const API = 'http://localhost:5000/api/auth';

  const register = async (username, password) => {
    const res = await axios.post(`${API}/register`, { username, password });
    const userData = { token: res.data.token, username: res.data.username };
    localStorage.setItem('chatUser', JSON.stringify(userData));
    setUser(userData);
  };

  const login = async (username, password) => {
    const res = await axios.post(`${API}/login`, { username, password });
    const userData = { token: res.data.token, username: res.data.username };
    localStorage.setItem('chatUser', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('chatUser');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
