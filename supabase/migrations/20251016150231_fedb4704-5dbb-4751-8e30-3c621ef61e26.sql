-- Create recipes table with all required fields
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  asset TEXT NOT NULL,
  time_horizon TEXT NOT NULL CHECK (time_horizon IN ('STH', 'LTH')),
  strategy_type TEXT NOT NULL,
  focus TEXT NOT NULL CHECK (focus IN ('Cash Yielding', 'Balanced', 'Accumulation')),
  goal TEXT NOT NULL,
  
  -- Parameters as JSONB for flexibility
  entry_trade TEXT NOT NULL,
  exit_trade TEXT NOT NULL,
  sell_above_cost_basis BOOLEAN DEFAULT true,
  exit_to_entry_proportion NUMERIC NOT NULL,
  time_frame TEXT NOT NULL,
  backtesting_period TEXT NOT NULL,
  
  -- Results
  initial_capital NUMERIC,
  cash_profit NUMERIC,
  asset_accumulated TEXT,
  net_profit TEXT,
  cagr NUMERIC,
  annualized_return NUMERIC,
  best_for TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view recipes (public read access)
CREATE POLICY "Anyone can view recipes" 
ON public.recipes 
FOR SELECT 
USING (true);

-- Policy: Only authenticated users can insert recipes (for admin panel)
CREATE POLICY "Authenticated users can insert recipes" 
ON public.recipes 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Policy: Only authenticated users can update recipes
CREATE POLICY "Authenticated users can update recipes" 
ON public.recipes 
FOR UPDATE 
TO authenticated
USING (true);

-- Policy: Only authenticated users can delete recipes
CREATE POLICY "Authenticated users can delete recipes" 
ON public.recipes 
FOR DELETE 
TO authenticated
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_recipes_updated_at
BEFORE UPDATE ON public.recipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert seed data
INSERT INTO public.recipes (name, asset, time_horizon, strategy_type, focus, goal, entry_trade, exit_trade, sell_above_cost_basis, exit_to_entry_proportion, time_frame, backtesting_period, initial_capital, cash_profit, asset_accumulated, net_profit, cagr, best_for)
VALUES 
('[BTC] STH Recipe No. 1: Daily Arbitrage', 'BTC', 'STH', 'Daily Arbitrage', 'Accumulation', 'Accumulate a Bitcoin position at a low cost basis while taking advantage of volatility to book cash profits.', 'Purchase $8,000 when price drops 3%', 'Sell $6,500 when price rises 3.5%', true, 81.25, 'Daily', 'January 2025–June 2025', 100000, 2742, '$96,170 (0.92 BTC @ $104,000)', '$20,455 (87% from BTC growth, 13% cash)', 45.29, NULL),

('[BTC] LTH Recipe No. 1: 6 hour Arbitrage', 'BTC', 'LTH', '6 hour Arbitrage', 'Accumulation', 'Maximize short-term cash profits in volatile intra-day markets while building a core BTC position.', 'Purchase $580 when price drops 2.5%', 'Sell $260 when price rises 2.1%', true, 44.8, '6 Hour', 'January 2019–April 2025', 50000, 98913, '$520,776 (6.53 BTC @ $79,588)', '$471,568 (79% from BTC growth, 21% cash)', 47.52, 'Clients comfortable with moderate activity for moderate cash and BTC growth'),

('[BTC] LTH Recipe No. 2: Daily Arbitrage', 'BTC', 'LTH', 'Daily Arbitrage', 'Accumulation', 'Maximize short-term cash profits in volatile markets while building a core BTC position.', 'Purchase $580 when price drops 2.5%', 'Sell $260 when price rises 2.1%', NULL, 44.8, '1 Day', 'January 2019–January 2025', NULL, 68440, '$246,189 (2.3 BTC @ $107,000)', '$314,629 (78% from BTC growth, 22% cash)', NULL, 'Clients comfortable with moderate activity for moderate cash and BTC growth'),

('[BTC] LTH Recipe No. 3: Cycle Arbitrage', 'BTC', 'LTH', 'Cycle Arbitrage', 'Balanced', 'Maximize BTC & Cash profits over entire market cycles, continuously.', 'Purchase $50,000 when price drops 20%', 'Sell $25,000 when price rises 16%', NULL, 50, '1 Week', 'January 2019–January 2025', NULL, 191840, '$991,553 (9.8 BTC @ $101,000)', '$1,183,393 (84% from BTC growth, 16% cash)', NULL, 'Clients deploying large capital at cycle bottoms and taking profits at tops'),

('[BTC] LTH Recipe No. 4: Bitcoin Yield', 'BTC', 'LTH', 'Bitcoin Yield', 'Cash Yielding', 'Maximize BTC yield while accumulating BTC.', 'Purchase $1,200 when price drops 2.5%', 'Sell $1,500 when price rises 2.1%', NULL, 125, '6 Hour', 'October 2021–April 2025', NULL, 102454, '$129,200 (1.36 BTC @ $95,000)', '$144,372 (29% from BTC growth, 71% cash)', NULL, 'Clients seeking significant cash yield with long-term BTC accumulation'),

('[SOL] STH Recipe No. 1: High Cash Flow', 'SOL', 'STH', 'High Cash Flow', 'Accumulation', 'Maximize short-term cash profits in volatile markets while building a small SOL position.', 'Purchase $14,000 when price drops 6%', 'Sell $11,500 when price rises 5%', NULL, 82.14, '1 Day', 'January 2025–June 2025', NULL, 19115, '$33,317 (227 SOL @ $146)', '$23,800 (20% from SOL growth, 80% cash)', 53.35, NULL),

('[SOL] LTH Recipe No. 1: High Cash Flow', 'SOL', 'LTH', 'High Cash Flow', 'Accumulation', 'Maximize short-term cash profits in volatile markets while building a small SOL position.', 'Purchase $2,900 when price drops 5%', 'Sell $1,300 when price rises 4.2%', NULL, 44.8, '1 Day', 'January 2023–March 2025', 100000, 81366, '$3,975 (34 SOL @ $117)', '$85,341 (5% from SOL growth, 95% cash)', NULL, 'Clients comfortable with moderate activity for large cash and incremental SOL growth'),

('[XRP] STH Recipe No. 1: Daily Cash Arbitrage', 'XRP', 'STH', 'Daily Cash Arbitrage', 'Cash Yielding', 'Maximize short-term cash profits using XRP volatility.', 'Purchase $15,000 when price drops 3.7%', 'Sell $16,000 when price rises 1.6%', true, 106.6, 'Daily', 'January 2025–June 2025', 100000, 26593, '$0', '$26,593 (100% cash)', 60.26, NULL),

('[XRP] STH Recipe No. 2: 6 Hour Cash Arbitrage', 'XRP', 'STH', '6 Hour Cash Arbitrage', 'Cash Yielding', 'Maximize short-term cash profits using XRP volatility.', 'Purchase $5,000 when price drops 2.5%', 'Sell $10,000 when price rises 2.2%', true, 200, '6 Hour', 'January 2025–July 2025', 100000, 17785, '$34,474 (14,490 XRP @ $2.37)', '$21,378 (83% cash)', 47.34, NULL),

('[XRP] LTH Recipe No. 1: 6 hour Arbitrage', 'XRP', 'LTH', '6 hour Arbitrage', 'Accumulation', 'Maximize short-term cash profits in volatile intra-day markets while building a core XRP position.', 'Purchase $18,000 when price drops 3.1%', 'Sell $16,000 when price rises 1.6%', true, 88.8, '6 Hour', 'December 2024–April 2025', 100000, 40369, '$76,752 (36,196 XRP @ $2.12)', '$49,027 (18% from XRP growth, 82% cash)', 122, 'Clients comfortable with moderate activity for substantial cash and XRP growth'),

('[XRP] LTH Recipe No. 2: 1 hour Cash Yield', 'XRP', 'LTH', '1 hour Cash Yield', 'Cash Yielding', 'Maximize cash profits while maintaining little to no XRP long term.', 'Purchase $7,000 when price drops 2.5%', 'Sell $14,583 when price rises 2.1%', true, 208, '1 Hour', 'December 2024–April 2025', 100000, 32272, '$0', '$32,272 (100% cash)', 88, 'Clients using XRP volatility for cash yield with low allocation risk'),

('[ETH] STH Recipe No. 1: Daily Cash Arbitrage', 'ETH', 'STH', 'Daily Cash Arbitrage', 'Cash Yielding', 'Generate strong cash returns leveraging Ethereum volatility.', 'Purchase $12,000 when price drops 7%', 'Sell $24,000 when price rises 6%', true, 200, '1 Day', 'January 2025–June 2025', 100000, 21789, '0 ETH', '$21,789 (100% Cash Yield)', 48.33, NULL),

('[ETH] STH Recipe No. 2: Daily Accumulation Arbitrage', 'ETH', 'STH', 'Daily Accumulation Arbitrage', 'Accumulation', 'Establish a sizable Ethereum position while minimizing drawdown.', 'Purchase $12,000 when price drops 7%', 'Sell $8,000 when price rises 6%', true, 66.6, '1 Day', 'January 2025–June 2025', 100000, -656, '$82,147 (32.5 ETH @ $2,500)', '$22,000', NULL, NULL);