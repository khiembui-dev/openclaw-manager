'use strict';

const express = require('express');
const router = express.Router();
const openclaw = require('../services/openclaw');
const config = require('../config');

// Dashboard / Overview
router.get('/', (req, res) => {
  res.render('dashboard', { title: 'Tổng quan', page: 'dashboard' });
});

// Service Info
router.get('/service', (req, res) => {
  res.render('service-info', { title: 'Thông tin dịch vụ', page: 'service' });
});

// Install page
router.get('/install', (req, res) => {
  res.render('install', { title: 'Cài đặt OpenClaw', page: 'install' });
});

// Domain & SSL
router.get('/domain', (req, res) => {
  res.render('domain-ssl', { title: 'Tên miền & SSL', page: 'domain' });
});

// AI Configuration
router.get('/ai-config', (req, res) => {
  res.render('ai-config', { title: 'Cấu hình AI', page: 'ai-config' });
});

// Multi-Agent
router.get('/agents', (req, res) => {
  res.render('multi-agent', { title: 'Multi-Agent', page: 'agents' });
});

// Channels
router.get('/channels', (req, res) => {
  res.render('channels', { title: 'Kênh kết nối', page: 'channels' });
});

// Version & Upgrade
router.get('/version', (req, res) => {
  res.render('version', { title: 'Phiên bản & Nâng cấp', page: 'version' });
});

// System Logs
router.get('/logs', (req, res) => {
  res.render('logs', { title: 'Nhật ký hệ thống', page: 'logs' });
});

// Service Control
router.get('/control', (req, res) => {
  res.render('control', { title: 'Điều khiển dịch vụ', page: 'control' });
});

// Backup
router.get('/backup', (req, res) => {
  res.render('backup', { title: 'Sao lưu & Phục hồi', page: 'backup' });
});

module.exports = router;
