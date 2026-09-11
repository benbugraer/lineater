UPDATE `issues`
SET `url` = 'https://linear.app/' || (
  SELECT `workspaces`.`url_key`
  FROM `teams`
  INNER JOIN `workspaces` ON `workspaces`.`id` = `teams`.`workspace_id`
  WHERE `teams`.`id` = `issues`.`team_id`
) || '/issue/' || `issues`.`identifier`
WHERE `url` = '';
