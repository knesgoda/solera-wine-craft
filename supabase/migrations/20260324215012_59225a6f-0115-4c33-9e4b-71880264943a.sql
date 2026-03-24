
-- Soft-delete GDD duplicate (keep "The Winemaker's Guide to Harvest Timing", remove "What Is Growing Degree Days")
UPDATE blog_posts SET published = false WHERE id = '9ef2ded5-ee93-444e-823a-131495bbe5d7';

-- Soft-delete Innovint duplicate (keep "The Complete 2026 Winery Software Comparison", remove "A Complete 2026 Comparison")
UPDATE blog_posts SET published = false WHERE id = '99a28f82-7d3b-46e3-85e2-7e11b14f0a41';

-- Keep the Feb 28 Innovint post (86b535e1) — different date and angle (Migration keyword)
-- But remove its featured flag since the Mar 19 post is the primary featured post
UPDATE blog_posts SET featured = false WHERE id = '86b535e1-5ae4-4fde-abcd-1649196c7c73';
