-- Rename per-project knowledge base root pages from "Knowledge Base" to "KB: <project name>"
UPDATE `wiki_pages`
SET
  `title` = 'KB: ' || (
    SELECT `p`.`name` FROM `projects` `p` WHERE `p`.`id` = `wiki_pages`.`project_id`
  ),
  `slug` = 'kb-' || lower(
    replace(
      replace(
        (SELECT `p`.`name` FROM `projects` `p` WHERE `p`.`id` = `wiki_pages`.`project_id`),
        ' ',
        '-'
      ),
      '_',
      '-'
    )
  ),
  `content` = replace(
    `content`,
    '# Knowledge Base',
    '# KB: ' || (
      SELECT `p`.`name` FROM `projects` `p` WHERE `p`.`id` = `wiki_pages`.`project_id`
    )
  )
WHERE `project_id` IS NOT NULL
  AND `parent_id` IS NULL
  AND `title` = 'Knowledge Base'
  AND EXISTS (
    SELECT 1 FROM `projects` `p` WHERE `p`.`id` = `wiki_pages`.`project_id`
  );
