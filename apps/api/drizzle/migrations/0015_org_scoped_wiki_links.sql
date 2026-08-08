-- Rewrite project-scoped wiki links in page content to org-scoped ones
WITH RECURSIVE
  numbered AS (
    SELECT p.id AS project_id, p.organization_id AS org_id,
           ROW_NUMBER() OVER (PARTITION BY p.organization_id ORDER BY p.id) AS rn
    FROM `projects` p
  ),
  folded(page_id, org_id, step, content) AS (
    SELECT w.id, w.organization_id, 0, w.content FROM `wiki_pages` w
    UNION ALL
    SELECT f.page_id, f.org_id, f.step + 1,
      replace(
        replace(f.content,
                '/orgs/' || f.org_id || '/projects/' || n.project_id || '/wiki/',
                '/orgs/' || f.org_id || '/wiki/'),
        '/orgs/' || f.org_id || '/projects/' || n.project_id || '/wiki',
        '/orgs/' || f.org_id || '/wiki')
    FROM folded f
    JOIN numbered n ON n.org_id = f.org_id AND n.rn = f.step + 1
  ),
  final AS (
    SELECT page_id, content FROM folded f
    WHERE f.step = (SELECT MAX(step) FROM folded g WHERE g.page_id = f.page_id)
  )
UPDATE `wiki_pages` SET `content` = (SELECT content FROM final WHERE final.page_id = `wiki_pages`.`id`)
WHERE EXISTS (SELECT 1 FROM final WHERE final.page_id = `wiki_pages`.`id`);
