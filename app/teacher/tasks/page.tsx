import { getCurriculumTree } from "@/app/curriculum/actions";
import { getStudents, getTasks } from "@/app/teacher/actions";
import { TeacherTasksClient } from "@/app/teacher/tasks/teacher-tasks-client";

export default async function TeacherTasksPage() {
  const [students, tasks, curriculum] = await Promise.all([
    getStudents(),
    getTasks(),
    getCurriculumTree(),
  ]);

  return (
    <TeacherTasksClient
      students={students}
      tasks={tasks}
      subjects={curriculum.subjects}
      topics={curriculum.topics}
    />
  );
}
