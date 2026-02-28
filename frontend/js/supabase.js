const SUPABASE_URL = "https://bftxtledvywijlokgcnu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdHh0bGVkdnl3aWpsb2tnY251Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjc5ODQsImV4cCI6MjA4Nzc0Mzk4NH0.ZDkvQELBL6EnR-74y4BkAUsL5h3Sb0LrSYjtDwhuTqI";

const { createClient } = window.supabase;

window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);