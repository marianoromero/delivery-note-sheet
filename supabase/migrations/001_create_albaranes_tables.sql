-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create albaranes table
CREATE TABLE albaranes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    image_url TEXT NOT NULL,
    image_path TEXT NOT NULL,
    status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
    supplier TEXT,
    document_number TEXT,
    document_date DATE,
    tax_id TEXT,
    total_amount DECIMAL(10,2),
    currency TEXT DEFAULT 'EUR',
    raw_text TEXT,
    processing_metadata JSONB
);

-- Create albaran_items table
CREATE TABLE albaran_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    albaran_id UUID NOT NULL REFERENCES albaranes(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT NOT NULL,
    quantity DECIMAL(10,3),
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    line_number INTEGER NOT NULL
);

-- Create indexes
CREATE INDEX idx_albaranes_status ON albaranes(status);
CREATE INDEX idx_albaranes_created_at ON albaranes(created_at DESC);
CREATE INDEX idx_albaranes_supplier ON albaranes(supplier);
CREATE INDEX idx_albaran_items_albaran_id ON albaran_items(albaran_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_albaranes_updated_at 
    BEFORE UPDATE ON albaranes 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE albaranes ENABLE ROW LEVEL SECURITY;
ALTER TABLE albaran_items ENABLE ROW LEVEL SECURITY;

-- Create policies (for now, allow all operations - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on albaranes" ON albaranes FOR ALL USING (true);
CREATE POLICY "Allow all operations on albaran_items" ON albaran_items FOR ALL USING (true);