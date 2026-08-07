-- Re-parent per-project knowledge base pages under their organization index page
UPDATE `wiki_pages`
SET `parent_id` = (
  SELECT `root`.`id`
  FROM `wiki_pages` `root`
  WHERE `root`.`organization_id` = `wiki_pages`.`organization_id`
    AND `root`.`slug` = 'root'
)
WHERE `project_id` IS NOT NULL
  AND `parent_id` IS NULL
  AND `title` LIKE 'KB: %'
  AND EXISTS (
    SELECT 1
    FROM `wiki_pages` `root`
    WHERE `root`.`organization_id` = `wiki_pages`.`organization_id`
      AND `root`.`slug` = 'root'
  );
